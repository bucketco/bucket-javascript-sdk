import { FeaturesClient, FeaturesOptions } from "./feature/features";
import {
  Feedback,
  feedback,
  FeedbackOptions as FeedbackOptions,
  LiveSatisfaction,
  RequestFeedbackOptions,
} from "./feedback/feedback";
import * as feedbackLib from "./feedback/ui";
import { API_HOST, SSE_REALTIME_HOST } from "./config";
import { BucketContext } from "./context";
import { HttpClient } from "./httpClient";
import { Logger, loggerWithPrefix, quietConsoleLogger } from "./logger";

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

export type User = {
  userId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: PayloadContext;
};

export type Company = {
  userId: string;
  companyId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: PayloadContext;
};

export type TrackedEvent = {
  event: string;
  userId: string;
  companyId?: string;
  attributes?: Record<string, any>;
  context?: PayloadContext;
};

export type PayloadContext = {
  active?: boolean;
};

interface Config {
  host: string;
  sseHost: string;
}

export interface InitOptions {
  logger?: Logger;
  host?: string;
  sseHost?: string;
  feedback?: FeedbackOptions;
  features?: FeaturesOptions;
  sdkVersion?: string;
}

const defaultConfig: Config = {
  host: API_HOST,
  sseHost: SSE_REALTIME_HOST,
};

export class BucketClient {
  private publishableKey: string;
  private context: BucketContext;
  private config: Config;
  private requestFeedbackOptions: Partial<RequestFeedbackOptions>;
  private logger: Logger;
  private httpClient: HttpClient;

  private liveSatisfaction: LiveSatisfaction | undefined;
  private liveSatisfactionInit: Promise<void> | undefined;
  private featuresClient: FeaturesClient;

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
      host: opts?.host ?? defaultConfig.host,
      sseHost: opts?.sseHost ?? defaultConfig.sseHost,
    } satisfies Config;

    this.requestFeedbackOptions = {
      position: opts?.feedback?.ui?.position,
      translations: opts?.feedback?.ui?.translations,
    };

    this.httpClient = new HttpClient(publishableKey, {
      baseUrl: this.config.host,
      sdkVersion: opts?.sdkVersion,
    });

    this.featuresClient = new FeaturesClient(
      this.httpClient,
      this.context,
      this.logger,
      opts?.features,
    );

    if (
      this.context?.user &&
      opts?.feedback?.enableLiveSatisfaction !== false // default to on
    ) {
      if (isMobile) {
        this.logger.warn(
          "Feedback prompting is not supported on mobile devices",
        );
      } else {
        this.liveSatisfaction = new LiveSatisfaction(
          this.config.sseHost,
          this.logger,
          this.httpClient,
          opts?.feedback?.liveSatisfactionHandler,
          String(this.context.user?.id),
          opts?.feedback?.ui?.position,
          opts?.feedback?.ui?.translations,
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
    if (this.liveSatisfaction) {
      // do not block on live satisfaction initialization
      this.liveSatisfactionInit = this.liveSatisfaction
        .initialize()
        .catch((e) => {
          this.logger.error("error initializing live satisfaction", e);
        });
    }

    await this.featuresClient.initialize();

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
    this.context.user = { id: this.context.user.id, ...attributes };

    const payload: User = {
      userId: String(this.context.user.id),
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
    const userId =
      payload.userId ||
      (this.context.user?.id ? String(this.context.user?.id) : undefined);
    const companyId =
      payload.companyId ||
      (this.context.company?.id ? String(this.context.company?.id) : undefined);
    return await feedback(this.httpClient, this.logger, {
      userId,
      companyId,
      ...payload,
    });
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

    const feedbackData = {
      featureId: options.featureId,
      companyId:
        options.companyId ||
        (this.context.company?.id
          ? String(this.context.company?.id)
          : undefined),
      source: "widget" as const,
    };

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        key: options.featureId,
        title: options.title,
        position: options.position || this.requestFeedbackOptions.position,
        translations:
          options.translations || this.requestFeedbackOptions.translations,
        openWithCommentVisible: options.openWithCommentVisible,
        onClose: options.onClose,
        onDismiss: options.onDismiss,
        onScoreSubmit: async (data) => {
          const res = await this.feedback({
            ...feedbackData,
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
            ...feedbackData,
            ...data,
          });

          options.onAfterSubmit?.(data);
        },
      });
    }, 1);
  }

  getFeatures() {
    return this.featuresClient.getFeatures();
  }

  async stop() {
    if (this.liveSatisfaction) {
      this.liveSatisfaction.stop();
      await this.liveSatisfactionInit;
    }
  }
}
