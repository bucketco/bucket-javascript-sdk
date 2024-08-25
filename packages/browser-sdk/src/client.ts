import { FeaturesClient, FeaturesOptions } from "./feature/features";
import {
  AutoFeedback,
  Feedback,
  feedback,
  FeedbackOptions as FeedbackOptions,
  handleDeprecatedFeedbackOptions,
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

  private autoFeedback: AutoFeedback | undefined;
  private autoFeedbackInit: Promise<void> | undefined;
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

    const feedbackOpts = handleDeprecatedFeedbackOptions(opts?.feedback);

    this.requestFeedbackOptions = {
      position: feedbackOpts?.ui?.position,
      translations: feedbackOpts?.ui?.translations,
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
      feedbackOpts?.enableAutoFeedback !== false // default to on
    ) {
      if (isMobile) {
        this.logger.warn(
          "Feedback prompting is not supported on mobile devices",
        );
      } else {
        this.autoFeedback = new AutoFeedback(
          this.config.sseHost,
          this.logger,
          this.httpClient,
          feedbackOpts?.autoFeedbackHandler,
          String(this.context.user?.id),
          feedbackOpts?.ui?.position,
          feedbackOpts?.ui?.translations,
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
    if (this.autoFeedback) {
      // do not block on automated feedback surveys initialization
      this.autoFeedbackInit = this.autoFeedback.initialize().catch((e) => {
        this.logger.error("error initializing automated feedback surveys", e);
      });
    }

    await this.featuresClient.initialize();

    if (this.context.user) {
      this.user(this.context.user).catch((e) => {
        this.logger.error("error sending user", e);
      });
    }

    if (this.context.company) {
      this.company(this.context.company).catch((e) => {
        this.logger.error("error sending company", e);
      });
    }

    this.logger.debug(
      `initialized with key "${this.publishableKey}" and options`,
      this.config,
    );
  }

  /**
   * Send attributes to Bucket for the current user
   *
   * @param attributes Any attributes you want to attach to the user in Bucket in addition
   * to the user ID and attributes provided at initialization
   */
  async user(attributes?: Record<string, any>) {
    if (!this.context.user) {
      this.logger.warn(
        "`user` call ignored. No user context provided at initialization",
      );
      return;
    }
    const payload: User = {
      userId: String(this.context.user.id),
      attributes,
    };
    const res = await this.httpClient.post({ path: `/user`, body: payload });
    this.logger.debug(`sent user`, res);
    return res;
  }

  /**
   * Send attributes to Bucket for the current company.
   *
   * @param attributes Any attributes you want to attach to the company in Bucket in addition
   * to the company ID and attributes provided at initialization
   */
  async company(attributes?: Record<string, any>) {
    if (!this.context.user) {
      this.logger.warn(
        "`company` call ignored. No user context provided at initialization",
      );
      return;
    }

    if (!this.context.company) {
      this.logger.warn(
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
   * This can be used to collect feedback from users in Bucket in cases where Automated Feedback Surveys isn't appropriate.
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
    if (this.autoFeedback) {
      // ensure fully initialized before stopping
      await this.autoFeedbackInit;
      this.autoFeedback.stop();
    }
  }
}
