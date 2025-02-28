import {
  CheckEvent,
  FallbackFeatureOverride,
  FeaturesClient,
  RawFeatures,
} from "./feature/features";
import {
  AutoFeedback,
  Feedback,
  feedback,
  FeedbackOptions,
  RequestFeedbackData,
  RequestFeedbackOptions,
} from "./feedback/feedback";
import * as feedbackLib from "./feedback/ui";
import { ToolbarPosition } from "./toolbar/Toolbar";
import { API_BASE_URL, APP_BASE_URL, SSE_REALTIME_BASE_URL } from "./config";
import { BucketContext, CompanyContext, UserContext } from "./context";
import { HookArgs, HooksManager } from "./hooksManager";
import { HttpClient } from "./httpClient";
import { Logger, loggerWithPrefix, quietConsoleLogger } from "./logger";
import { showToolbarToggle } from "./toolbar";

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
const isNode = typeof document === "undefined"; // deno supports "window" but not "document" according to https://remix.run/docs/en/main/guides/gotchas

/**
 * (Internal) User context.
 *
 * @internal
 */
export type User = {
  /**
   * Identifier of the user.
   */
  userId: string;

  /**
   * User attributes.
   */
  attributes?: {
    /**
     * Name of the user.
     */
    name?: string;

    /**
     * Email of the user.
     */
    email?: string;

    /**
     * Avatar URL of the user.
     */
    avatar?: string;

    /**
     * Custom attributes of the user.
     */
    [key: string]: any;
  };

  /**
   * Custom context of the user.
   */
  context?: PayloadContext;
};

/**
 * (Internal) Company context.
 *
 * @internal
 */
export type Company = {
  /**
   * User identifier.
   */
  userId: string;

  /**
   * Company identifier.
   */
  companyId: string;

  /**
   * Company attributes.
   */
  attributes?: {
    /**
     * Name of the company.
     */
    name?: string;

    /**
     * Custom attributes of the company.
     */
    [key: string]: any;
  };

  context?: PayloadContext;
};

/**
 * Tracked event.
 */
export type TrackedEvent = {
  /**
   * Event name.
   */
  event: string;

  /**
   * User identifier.
   */
  userId: string;

  /**
   * Company identifier.
   */
  companyId?: string;

  /**
   * Event attributes.
   */
  attributes?: Record<string, any>;

  /**
   * Custom context of the event.
   */
  context?: PayloadContext;
};

/**
 * (Internal) Custom context of the event.
 *
 * @internal
 */
export type PayloadContext = {
  /**
   * Whether the company and user associated with the event are active.
   */
  active?: boolean;
};

/**
 * BucketClient configuration.
 */
interface Config {
  /**
   * Base URL of Bucket servers.
   */
  apiBaseUrl: string;

  /**
   * Base URL of the Bucket web app.
   */
  appBaseUrl: string;

  /**
   * Base URL of Bucket servers for SSE connections used by AutoFeedback.
   */
  sseBaseUrl: string;

  /**
   * Whether to enable tracking.
   */
  enableTracking: boolean;
}

/**
 * Toolbar options.
 */
export type ToolbarOptions =
  | boolean
  | {
      show?: boolean;
      position?: ToolbarPosition;
    };

/**
 * Feature definitions.
 */
export type FeatureDefinitions = Readonly<Array<string>>;

/**
 * BucketClient initialization options.
 */
export type InitOptions = {
  /**
   * Publishable key for authentication
   */
  publishableKey: string;

  /**
   * User related context. If you provide `id` Bucket will enrich the evaluation context with
   * user attributes on Bucket servers.
   */
  user?: UserContext;

  /**
   * Company related context. If you provide `id` Bucket will enrich the evaluation context with
   * company attributes on Bucket servers.
   */
  company?: CompanyContext;

  /**
   * Context not related to users or companies
   */
  otherContext?: Record<string, any>;

  /**
   * You can provide a logger to see the logs of the network calls.
   * This is undefined by default.
   * For debugging purposes you can just set the browser console to this property:
   * ```javascript
   * options.logger = window.console;
   * ```
   */
  logger?: Logger;

  /**
   * Base URL of Bucket servers. You can override this to use your mocked server.
   */
  apiBaseUrl?: string;

  /**
   * Base URL of the Bucket web app. Links open ín this app by default.
   */
  appBaseUrl?: string;

  /**
   * Feature keys for which `isEnabled` should fallback to true
   * if SDK fails to fetch features from Bucket servers. If a record
   * is supplied instead of array, the values of each key represent the
   * configuration values and `isEnabled` is assume `true`.
   */
  fallbackFeatures?: string[] | Record<string, FallbackFeatureOverride>;

  /**
   * Timeout in milliseconds when fetching features
   */
  timeoutMs?: number;

  /**
   * If set to true stale features will be returned while refetching features
   */
  staleWhileRevalidate?: boolean;

  /**
   * If set, features will be cached between page loads for this duration
   */
  expireTimeMs?: number;

  /**
   * Stale features will be returned if staleWhileRevalidate is true if no new features can be fetched
   */
  staleTimeMs?: number;

  /**
   * When proxying requests, you may want to include credentials like cookies
   * so you can authorize the request in the proxy.
   * This option controls the `credentials` option of the fetch API.
   */
  credentials?: "include" | "same-origin" | "omit";

  /**
   * Base URL of Bucket servers for SSE connections used by AutoFeedback.
   */
  sseBaseUrl?: string;

  /**
   * AutoFeedback specific configuration
   */
  feedback?: FeedbackOptions;

  /**
   * Version of the SDK
   */
  sdkVersion?: string;

  /**
   * Whether to enable tracking. Defaults to `true`.
   */
  enableTracking?: boolean;

  /**
   * Toolbar configuration
   */
  toolbar?: ToolbarOptions;
};

const defaultConfig: Config = {
  apiBaseUrl: API_BASE_URL,
  appBaseUrl: APP_BASE_URL,
  sseBaseUrl: SSE_REALTIME_BASE_URL,
  enableTracking: true,
};

/**
 * A remotely managed configuration value for a feature.
 */
export type FeatureRemoteConfig =
  | {
      /**
       * The key of the matched configuration value.
       */
      key: string;

      /**
       * The optional user-supplied payload data.
       */
      payload: any;
    }
  | { key: undefined; payload: undefined };

/**
 * Represents a feature.
 */
export interface Feature {
  /**
   * Result of feature flag evaluation.
   */
  isEnabled: boolean;

  /*
   * Optional user-defined configuration.
   */
  config: FeatureRemoteConfig;

  /**
   * Function to send analytics events for this feature.
   */
  track: () => Promise<Response | undefined>;

  /**
   * Function to request feedback for this feature.
   */
  requestFeedback: (
    options: Omit<RequestFeedbackData, "featureKey" | "featureId">,
  ) => void;
}

function shouldShowToolbar(opts: InitOptions) {
  const toolbarOpts = opts.toolbar;
  if (typeof toolbarOpts === "boolean") return toolbarOpts;
  if (typeof toolbarOpts?.show === "boolean") return toolbarOpts.show;

  return window?.location?.hostname === "localhost";
}

/**
 * BucketClient lets you interact with the Bucket API.
 */
export class BucketClient {
  private readonly publishableKey: string;
  private readonly context: BucketContext;
  private config: Config;
  private requestFeedbackOptions: Partial<RequestFeedbackOptions>;
  private readonly httpClient: HttpClient;

  private readonly autoFeedback: AutoFeedback | undefined;
  private autoFeedbackInit: Promise<void> | undefined;
  private readonly featuresClient: FeaturesClient;

  public readonly logger: Logger;

  private readonly hooks: HooksManager;

  /**
   * Create a new BucketClient instance.
   */
  constructor(opts: InitOptions) {
    this.publishableKey = opts.publishableKey;
    this.logger =
      opts?.logger ?? loggerWithPrefix(quietConsoleLogger, "[Bucket]");
    this.context = {
      user: opts?.user?.id ? opts.user : undefined,
      company: opts?.company?.id ? opts.company : undefined,
      otherContext: opts?.otherContext,
    };

    this.config = {
      apiBaseUrl: opts?.apiBaseUrl ?? defaultConfig.apiBaseUrl,
      appBaseUrl: opts?.appBaseUrl ?? defaultConfig.appBaseUrl,
      sseBaseUrl: opts?.sseBaseUrl ?? defaultConfig.sseBaseUrl,
      enableTracking: opts?.enableTracking ?? defaultConfig.enableTracking,
    };

    this.requestFeedbackOptions = {
      position: opts?.feedback?.ui?.position,
      translations: opts?.feedback?.ui?.translations,
    };

    this.httpClient = new HttpClient(this.publishableKey, {
      baseUrl: this.config.apiBaseUrl,
      sdkVersion: opts?.sdkVersion,
      credentials: opts?.credentials,
    });

    this.featuresClient = new FeaturesClient(
      this.httpClient,
      // API expects `other` and we have `otherContext`.
      {
        user: this.context.user,
        company: this.context.company,
        other: this.context.otherContext,
      },
      this.logger,
      {
        expireTimeMs: opts.expireTimeMs,
        staleTimeMs: opts.staleTimeMs,
        fallbackFeatures: opts.fallbackFeatures,
        timeoutMs: opts.timeoutMs,
      },
    );

    if (
      this.context?.user &&
      !isNode && // do not prompt on server-side
      opts?.feedback?.enableAutoFeedback !== false // default to on
    ) {
      if (isMobile) {
        this.logger.warn(
          "Feedback prompting is not supported on mobile devices",
        );
      } else {
        this.autoFeedback = new AutoFeedback(
          this.config.sseBaseUrl,
          this.logger,
          this.httpClient,
          opts?.feedback?.autoFeedbackHandler,
          String(this.context.user?.id),
          opts?.feedback?.ui?.position,
          opts?.feedback?.ui?.translations,
        );
      }
    }

    if (shouldShowToolbar(opts)) {
      this.logger.info("opening toolbar toggler");
      showToolbarToggle({
        bucketClient: this,
        position:
          typeof opts.toolbar === "object" ? opts.toolbar.position : undefined,
      });
    }

    // Register hooks
    this.hooks = new HooksManager();
    this.featuresClient.onUpdated(() => {
      this.hooks.trigger("featuresUpdated", this.featuresClient.getFeatures());
    });
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
    if (this.context.user && this.config.enableTracking) {
      this.user().catch((e) => {
        this.logger.error("error sending user", e);
      });
    }

    if (this.context.company && this.config.enableTracking) {
      this.company().catch((e) => {
        this.logger.error("error sending company", e);
      });
    }
  }

  /**
   * Add a hook to the client.
   *
   * @param hook Hook to add.
   * @returns A function to remove the hook.
   */
  on<THookType extends keyof HookArgs>(
    type: THookType,
    handler: (args0: HookArgs[THookType]) => void,
  ) {
    this.hooks.addHook(type, handler);
    return () => this.hooks.removeHook(type, handler);
  }

  /**
   * Remove a hook from the client.
   *
   * @param hook Hook to add.
   * @returns A function to remove the hook.
   */
  off<THookType extends keyof HookArgs>(
    type: THookType,
    handler: (args0: HookArgs[THookType]) => void,
  ) {
    return this.hooks.removeHook(type, handler);
  }

  /**
   * Get the current configuration.
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update the user context.
   * Performs a shallow merge with the existing user context.
   * Attempting to update the user ID will log a warning and be ignored.
   *
   * @param user
   */
  async updateUser(user: { [key: string]: string | number | undefined }) {
    if (user.id && user.id !== this.context.user?.id) {
      this.logger.warn(
        "ignoring attempt to update the user ID. Re-initialize the BucketClient with a new user ID instead.",
      );
      return;
    }

    this.context.user = {
      ...this.context.user,
      ...user,
      id: user.id ?? this.context.user?.id,
    };
    void this.user();
    await this.featuresClient.setContext(this.context);
  }

  /**
   * Update the company context.
   * Performs a shallow merge with the existing company context.
   * Attempting to update the company ID will log a warning and be ignored.
   *
   * @param company The company details.
   */
  async updateCompany(company: { [key: string]: string | number | undefined }) {
    if (company.id && company.id !== this.context.company?.id) {
      this.logger.warn(
        "ignoring attempt to update the company ID. Re-initialize the BucketClient with a new company ID instead.",
      );
      return;
    }
    this.context.company = {
      ...this.context.company,
      ...company,
      id: company.id ?? this.context.company?.id,
    };
    void this.company();
    await this.featuresClient.setContext(this.context);
  }

  /**
   * Update the company context.
   * Performs a shallow merge with the existing company context.
   * Updates to the company ID will be ignored.
   *
   * @param otherContext Additional context.
   */
  async updateOtherContext(otherContext: {
    [key: string]: string | number | undefined;
  }) {
    this.context.otherContext = {
      ...this.context.otherContext,
      ...otherContext,
    };
    await this.featuresClient.setContext(this.context);
  }

  /**
   * Track an event in Bucket.
   *
   * @param eventName The name of the event.
   * @param attributes Any attributes you want to attach to the event.
   */
  async track(eventName: string, attributes?: Record<string, any> | null) {
    if (!this.context.user) {
      this.logger.warn("'track' call ignored. No user context provided");
      return;
    }
    if (!this.config.enableTracking) {
      this.logger.warn("'track' call ignored. 'enableTracking' is false");
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

    this.hooks.trigger("track", {
      eventName,
      attributes,
      user: this.context.user,
      company: this.context.company,
    });
    return res;
  }

  /**
   * Submit user feedback to Bucket. Must include either `score` or `comment`, or both.
   *
   * @param payload The feedback details to submit.
   * @returns The server response.
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
  requestFeedback(options: RequestFeedbackData) {
    if (!this.context.user?.id) {
      this.logger.error(
        "`requestFeedback` call ignored. No `user` context provided at initialization",
      );
      return;
    }

    if (!options.featureKey) {
      this.logger.error(
        "`requestFeedback` call ignored. No `featureKey` provided",
      );
      return;
    }

    const feedbackData = {
      featureKey: options.featureKey,
      companyId:
        options.companyId ||
        (this.context.company?.id
          ? String(this.context.company?.id)
          : undefined),
      source: "widget" as const,
    } satisfies Feedback;

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        key: options.featureKey,
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

  /**
   * Returns a map of enabled features.
   * Accessing a feature will *not* send a check event
   * and `isEnabled` does not take any feature overrides
   * into account.
   *
   * @returns Map of features.
   */
  getFeatures(): RawFeatures {
    return this.featuresClient.getFeatures();
  }

  /**
   * Return a feature. Accessing `isEnabled` or `config` will automatically send a `check` event.
   * @returns A feature.
   */
  getFeature(key: string): Feature {
    const f = this.getFeatures()[key];

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const value = f?.isEnabledOverride ?? f?.isEnabled ?? false;
    const config = f?.config
      ? {
          key: f.config.key,
          payload: f.config.payload,
        }
      : { key: undefined, payload: undefined };

    return {
      get isEnabled() {
        self
          .sendCheckEvent({
            action: "check-is-enabled",
            key,
            version: f?.targetingVersion,
            ruleEvaluationResults: f?.ruleEvaluationResults,
            missingContextFields: f?.missingContextFields,
            value,
          })
          .catch(() => {
            // ignore
          });
        return value;
      },
      get config() {
        self
          .sendCheckEvent({
            action: "check-config",
            key,
            version: f?.config?.version,
            ruleEvaluationResults: f?.config?.ruleEvaluationResults,
            missingContextFields: f?.config?.missingContextFields,
            value: f?.config && {
              key: f.config.key,
              payload: f.config.payload,
            },
          })
          .catch(() => {
            // ignore
          });

        return config;
      },
      track: () => this.track(key),
      requestFeedback: (
        options: Omit<RequestFeedbackData, "featureKey" | "featureId">,
      ) => {
        this.requestFeedback({
          featureKey: key,
          ...options,
        });
      },
    };
  }

  /**
   * @internal
   */
  setFeatureOverride(key: string, isEnabled: boolean | null) {
    this.featuresClient.setFeatureOverride(key, isEnabled);
  }

  /**
   * @internal
   */
  getFeatureOverride(key: string): boolean | null {
    return this.featuresClient.getFeatureOverride(key);
  }

  private sendCheckEvent(checkEvent: CheckEvent) {
    return this.featuresClient.sendCheckEvent(checkEvent, () => {
      this.hooks.trigger(
        checkEvent.action == "check-config" ? "configCheck" : "enabledCheck",
        checkEvent,
      );
    });
  }

  /**
   * Stop the SDK.
   * This will stop any automated feedback surveys.
   *
   **/
  async stop() {
    if (this.autoFeedback) {
      // ensure fully initialized before stopping
      await this.autoFeedbackInit;
      this.autoFeedback.stop();
    }

    this.featuresClient.stop();
  }

  /**
   * Send attributes to Bucket for the current user
   */
  private async user() {
    if (!this.context.user) {
      this.logger.warn(
        "`user` call ignored. No user context provided at initialization",
      );
      return;
    }

    const { id, ...attributes } = this.context.user;
    const payload: User = {
      userId: String(id),
      attributes,
    };
    const res = await this.httpClient.post({ path: `/user`, body: payload });
    this.logger.debug(`sent user`, res);

    this.hooks.trigger("user", this.context.user);
    return res;
  }

  /**
   * Send attributes to Bucket for the current company.
   */
  private async company() {
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

    const { id, ...attributes } = this.context.company;
    const payload: Company = {
      userId: String(this.context.user.id),
      companyId: String(id),
      attributes,
    };

    const res = await this.httpClient.post({ path: `/company`, body: payload });
    this.logger.debug(`sent company`, res);
    this.hooks.trigger("company", this.context.company);
    return res;
  }
}
