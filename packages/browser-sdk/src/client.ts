import { API_HOST, SSE_REALTIME_HOST } from "./config";
import {
  Company,
  DEFAULT_FEEDBACK_CONFIG,
  feedback,
  Feedback,
  FeedbackConfig,
  LiveSatisfaction,
  RequestFeedbackOptions,
  TrackedEvent,
  User,
} from "./feedback/feedback";
import {
  DEFAULT_FLAGS_CONFIG,
  FeatureFlagsOptions,
  FlagsClient,
} from "./flags/flags";
import { Logger, loggerWithPrefix, quietConsoleLogger } from "./logger";
import { HttpClient } from "./httpClient";
import * as feedbackLib from "./feedback/ui";

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

interface Config {
  debug: boolean;
  host: string;
  sseHost: string;
  feedback: FeedbackConfig;
  flags: FeatureFlagsOptions;
}

interface InitOptions {
  logger?: Logger;
  host?: string;
  sseHost?: string;
  feedback?: FeedbackConfig;
  flags?: FeatureFlagsOptions;
}

const defaultConfig: Config = {
  debug: false,
  host: API_HOST,
  sseHost: SSE_REALTIME_HOST,
  feedback: DEFAULT_FEEDBACK_CONFIG,
  flags: DEFAULT_FLAGS_CONFIG,
};

export class BucketClient {
  private publishableKey: string;
  private context: BucketContext;
  private config: Config;
  private logger: Logger;
  private httpClient: HttpClient;

  private liveSatisfaction: LiveSatisfaction | undefined;
  private flagsClient: FlagsClient;

  constructor(
    publishableKey: string,
    context?: BucketContext,
    opts?: InitOptions,
  ) {
    this.publishableKey = publishableKey;
    this.logger =
      opts?.logger ?? loggerWithPrefix(quietConsoleLogger, "[Bucket]");
    this.context = context ?? {};
    this.config = {
      ...defaultConfig,
      ...opts,
      feedback: {
        ...defaultConfig.feedback,
        ...opts?.feedback,
      },
      flags: {
        ...defaultConfig.flags,
        ...opts?.flags,
      },
    };
    this.httpClient = new HttpClient(publishableKey, this.config.host);

    this.flagsClient = new FlagsClient(
      this.httpClient,
      this.context,
      this.logger,
      this.config.flags,
    );

    if (this.context?.user && this.config.feedback.liveSatisfactionEnabled) {
      if (isMobile) {
        this.logger.warn(
          "Feedback prompting is not supported on mobile devices",
        );
      } else {
        this.liveSatisfaction = new LiveSatisfaction(
          this.config.sseHost,
          this.logger,
          this.httpClient,
          this.config.feedback.promptHandler,
          String(this.context.user?.id),
        );
      }
    }
  }

  /**
   * Initialize the Bucket SDK.
   *
   * Must be called before calling other SDK methods.
   */
  async initialize() {
    const inits = [this.flagsClient.initialize()];
    if (this.liveSatisfaction) {
      inits.push(this.liveSatisfaction.init());
    }
    await Promise.all(inits);

    this.logger.debug(
      `initialized with key "${this.publishableKey}" and options`,
      this.config,
    );
  }

  /**
   * Store attributes for this user
   *
   * @param attributes Any attributes you want to attach to the user in Bucket
   */
  async user(attributes?: Record<string, any>) {
    if (!this.context.user) {
      this.logger.debug(
        "`user` call ignored. No user context provided at initialization",
      );
      return;
    }
    this.context.user = { id: this.context.user.Id, ...attributes };

    const payload: User = {
      userId: String(this.context.user.Id),
      attributes,
    };
    const res = await this.httpClient.post({ path: `/user`, body: payload });
    this.logger.debug(`sent user`, res);
    return res;
  }

  /**
   * Set additional attributes for the current company.
   *
   * @param attributes Any attributes you want to attach to the company in Bucket
   */
  async company(attributes?: Record<string, any>) {
    if (!this.context.user) {
      this.logger.debug(
        "`company` call ignored. No user context provided at initialization",
      );
      return;
    }

    if (!this.context.company) {
      this.logger.debug(
        "`company` call ignored. No company context provided at initialization",
      );
      return;
    }

    const payload: Company = {
      userId: String(this.context.user.id),
      companyId: String(this.context.company.id),
      attributes,
    };

    const res = await this.httpClient.post({ path: `/company`, body: payload });
    this.logger.debug(`sent company`, res);
    return res;
  }

  /**
   * Track an event in Bucket.
   *
   * @param eventName The name of the event
   * @param attributes Any attributes you want to attach to the event
   */
  async track(eventName: string, attributes?: Record<string, any> | null) {
    if (!this.context.user) {
      this.logger.debug("'track' call ignore. No user context provided");
      return;
    }

    const payload: TrackedEvent = {
      userId: String(this.context.user.id),
      event: eventName,
    };
    if (attributes) payload.attributes = attributes;
    if (this.context.company?.id)
      payload.companyId = String(this.context.company?.id);

    const res = await this.httpClient.post({ path: `/event`, body: payload });
    this.logger.debug(`sent event`, res);
    return res;
  }

  /**
   * Submit user feedback to Bucket. Must include either `score` or `comment`, or both.
   *
   * @param options
   * @returns
   */
  async feedback(payload: Feedback) {
    return await feedback(this.httpClient, this.logger, payload);
  }

  /**
   * Display the Bucket feedback form UI programmatically.
   *
   * This can be used to collect feedback from users in Bucket in cases where Live Satisfaction isn't appropriate.
   *
   * @param options
   */
  requestFeedback(options: RequestFeedbackOptions) {
    if (!this.context.user?.id) {
      this.logger.error(
        "`requestFeedback` call ignored. No user context provided at initialization",
      );
      return;
    }

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        key: options.featureId,
        title: options.title,
        position: options.position ?? this.config.feedback.position,
        translations: options.translations ?? this.config.feedback.translations,
        openWithCommentVisible: options.openWithCommentVisible,
        onClose: options.onClose,
        onDismiss: options.onDismiss,
        onScoreSubmit: async (data) => {
          const res = await this.feedback({
            featureId: options.featureId,
            companyId: options.companyId,
            source: "widget",
            ...data,
          });

          if (res) {
            const json = await res.json();
            return { feedbackId: json.feedbackId };
          }
          return { feedbackId: undefined };
        },
        onSubmit: async (data) => {
          // Default onSubmit handler
          await this.feedback({
            featureId: options.featureId,
            companyId: options.companyId,
            source: "widget",
            ...data,
          });

          options.onAfterSubmit?.(data);
        },
      });
    }, 1);
  }

  async getFlags() {
    return this.flagsClient.getFlags();
  }

  stop() {
    if (this.liveSatisfaction) {
      this.liveSatisfaction.stop();
    }
  }
}
