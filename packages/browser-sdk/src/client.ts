import {
  CheckEvent,
  FeaturesClient,
  FeaturesOptions,
  RawFeature,
  RawFeatures,
} from "./feature/features";
import {
  AutoFeedback,
  Feedback,
  feedback,
  FeedbackOptions as FeedbackOptions,
  handleDeprecatedFeedbackOptions,
  RequestFeedbackData,
  RequestFeedbackOptions,
} from "./feedback/feedback";
import * as feedbackLib from "./feedback/ui";
import { ToolbarPosition } from "./toolbar/Toolbar";
import { API_HOST, SSE_REALTIME_HOST } from "./config";
import { BucketContext, CompanyContext, UserContext } from "./context";
import { HttpClient } from "./httpClient";
import { Logger, loggerWithPrefix, quietConsoleLogger } from "./logger";
import { showToolbarToggle } from "./toolbar";

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
const isNode = typeof document === "undefined"; // deno supports "window" but not "document" according to https://remix.run/docs/en/main/guides/gotchas

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
  enableTracking: boolean;
}

type DataType =
  | "boolean"
  | "string"
  | "number"
  | "object"
  | "array"
  | { [key: string]: DataType }
  | ["string"];

type FeatureDefinition = Readonly<{
  key: string;
  config?: DataType;
  access?: boolean;
}>;

export type FeatureDefinitions = Readonly<Array<string | FeatureDefinition>>;

export function defineFeatures<T extends FeatureDefinitions>(features: T): T {
  return features;
}

type ToType<T> = T extends "boolean"
  ? boolean
  : T extends "string"
    ? string
    : T extends "number"
      ? number
      : T extends "object"
        ? object
        : T extends "array"
          ? any[]
          : T extends object
            ? { [K in keyof T]: ToType<T[K]> }
            : undefined;

export type FeatureKey<Defs extends FeatureDefinitions> =
  | Extract<Defs[number], { key: string }>["key"]
  | Extract<Defs[number], string>;

type ToConfigType<
  U extends FeatureDefinitions,
  Key extends FeatureKey<U>,
> = ToType<
  Extract<U, { key: Key }> extends { config: infer C } ? C : undefined
>;

type Keys<Defs extends FeatureDefinitions> =
  | Extract<Defs[number], { key: string }>["key"]
  | Extract<Defs[number], string>;

type GetFeature<Defs extends FeatureDefinitions, T extends Keys<Defs>> = {
  track: () => Promise<Response | undefined>;
  requestFeedback: (
    options: Omit<RequestFeedbackData, "featureKey" | "featureId">,
  ) => void;
} & (Extract<Defs[number], string> extends T // figure out `access`
  ? { isEnabled: boolean }
  : Extract<Defs[number], { key: T }> extends { access: false }
    ? unknown
    : { isEnabled: boolean }) &
  // extend with {config: ...} if its enabled
  (ToConfigType<Defs, T> extends undefined
    ? unknown
    : {
        config: ToConfigType<Defs, T>;
      });

export type ToolbarOptions =
  | boolean
  | {
      show?: boolean;
      position?: ToolbarPosition;
    };

export interface InitOptions<
  FeatureDefs extends FeatureDefinitions = FeatureDefinitions,
> {
  publishableKey: string;
  user?: UserContext;
  company?: CompanyContext;
  otherContext?: Record<string, any>;
  logger?: Logger;
  host?: string;
  sseHost?: string;
  feedback?: FeedbackOptions;
  features?: FeaturesOptions;
  featureDefinitions?: FeatureDefs;
  sdkVersion?: string;
  enableTracking?: boolean;
  toolbar?: ToolbarOptions;
}

const defaultConfig: Config = {
  host: API_HOST,
  sseHost: SSE_REALTIME_HOST,
  enableTracking: true,
};

export interface Feature {
  isEnabled: boolean;
  track: () => Promise<Response | undefined>;
  requestFeedback: (
    options: Omit<RequestFeedbackData, "featureKey" | "featureId">,
  ) => void;
}

function shouldShowToolbar(opts?: ToolbarOptions) {
  return (
    opts === true ||
    (typeof opts === "object" && opts.show === true) ||
    window?.location?.hostname === "localhost"
  );
}

export class BucketClient<
  FeatureDefs extends FeatureDefinitions = FeatureDefinitions,
> extends EventTarget {
  private publishableKey: string;
  private context: BucketContext;
  private config: Config;
  private requestFeedbackOptions: Partial<RequestFeedbackOptions>;
  private logger: Logger;
  private httpClient: HttpClient;

  // eslint-disable-next-line @typescript-eslint/ban-types
  private featureDefs: FeatureDefs | {};
  private featureAccessOverrides: Record<string, boolean> = {};

  private autoFeedback: AutoFeedback | undefined;
  private autoFeedbackInit: Promise<void> | undefined;
  private featuresClient: FeaturesClient;

  constructor(opts: InitOptions<FeatureDefs>) {
    super();
    this.publishableKey = opts.publishableKey;
    this.featureDefs = opts.featureDefinitions ?? {};
    this.featureAccessOverrides;
    this.logger =
      opts?.logger ?? loggerWithPrefix(quietConsoleLogger, "[Bucket]");
    this.context = {
      user: opts?.user?.id ? opts.user : undefined,
      company: opts?.company?.id ? opts.company : undefined,
      otherContext: opts?.otherContext,
    };

    this.config = {
      host: opts?.host ?? defaultConfig.host,
      sseHost: opts?.sseHost ?? defaultConfig.sseHost,
      enableTracking: opts?.enableTracking ?? defaultConfig.enableTracking,
    } satisfies Config;

    const feedbackOpts = handleDeprecatedFeedbackOptions(opts?.feedback);

    this.requestFeedbackOptions = {
      position: feedbackOpts?.ui?.position,
      translations: feedbackOpts?.ui?.translations,
    };

    this.httpClient = new HttpClient(this.publishableKey, {
      baseUrl: this.config.host,
      sdkVersion: opts?.sdkVersion,
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
      opts?.features,
    );

    if (
      this.context?.user &&
      !isNode && // do not prompt on server-side
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

    if (shouldShowToolbar(opts.toolbar)) {
      this.logger.info("opening toolbar toggler");
      showToolbarToggle({
        bucketClient: this as unknown as BucketClient,
        position:
          typeof opts.toolbar === "object" ? opts.toolbar.position : undefined,
      });
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
    return res;
  }

  /**
   * Submit user feedback to Bucket. Must include either `score` or `comment`, or both.
   *
   * @param options
   * @returns
   */
  async feedback(payload: Feedback & { featureKey?: FeatureKey<FeatureDefs> }) {
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
  requestFeedback(
    options: RequestFeedbackData & { featureKey?: FeatureKey<FeatureDefs> },
  ) {
    if (!this.context.user?.id) {
      this.logger.error(
        "`requestFeedback` call ignored. No `user` context provided at initialization",
      );
      return;
    }

    const featureId = "featureId" in options ? options.featureId : undefined;
    const featureKey = "featureKey" in options ? options.featureKey : undefined;

    if (!featureId && !featureKey) {
      this.logger.error(
        "`requestFeedback` call ignored. No `featureId` or `featureKey` provided",
      );
      return;
    }

    const feedbackData = {
      featureId,
      featureKey,
      companyId:
        options.companyId ||
        (this.context.company?.id
          ? String(this.context.company?.id)
          : undefined),
      source: "widget" as const,
    } as Feedback;

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        key: (featureKey || featureId)!,
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
   * and it does not take any feature overrides into account.
   *
   * @returns Map of features
   */
  getFeatures(): RawFeatures {
    // copy this before we update it
    const features = { ...this.featuresClient.getFeatures() } as Record<
      string,
      (RawFeature & { localOverride: boolean | null }) | undefined
    >;
    for (const key in this.featureDefs) {
      if (key in features) continue;
      features[key] = {
        key,
        isEnabled: false,
        targetingVersion: 0,
        localOverride: null,
      };
    }

    for (const key in features) {
      if (!features[key]) continue;
      features[key].localOverride = this.getEnabledOverride(key);
    }

    return features;
  }

  /**
   * Return a feature. Accessing `isEnabled` will automatically send a `check` event.
   * @returns A feature
   */
  getFeature(
    key: FeatureKey<FeatureDefs>,
  ): GetFeature<FeatureDefs, FeatureKey<FeatureDefs>> {
    const f = this.getFeatures()[key];

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const bClient = this;
    const fClient = this.featuresClient;
    const value = f?.isEnabled ?? false;

    return {
      config: f?.config,
      get isEnabled() {
        fClient
          .sendCheckEvent({
            key: String(key),
            version: f?.targetingVersion,
            value,
          })
          .catch(() => {
            // ignore
          });
        return bClient.featureAccessOverrides[key] ?? value;
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

  setEnabledOverride(key: FeatureKey<FeatureDefs>, value: boolean | null) {
    if (!(typeof value === "boolean" || value === null)) {
      throw new Error("setEnabledOverride: value must be boolean or null");
    }
    if (value === null) {
      delete this.featureAccessOverrides[key];
    } else {
      this.featureAccessOverrides[key] = value;
    }
    this.dispatchEvent(new Event("featuresChanged"));
  }

  getEnabledOverride(key: FeatureKey<FeatureDefs>): boolean | null {
    return this.featureAccessOverrides[key] ?? null;
  }

  sendCheckEvent(checkEvent: CheckEvent) {
    return this.featuresClient.sendCheckEvent(checkEvent);
  }

  /**
   * Stop the SDK. This will stop any automated feedback surveys.
   *
   **/
  async stop() {
    if (this.autoFeedback) {
      // ensure fully initialized before stopping
      await this.autoFeedbackInit;
      this.autoFeedback.stop();
    }
  }
}
