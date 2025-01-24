import {
  ErrorCode,
  EvaluationContext,
  JsonValue,
  OpenFeatureEventEmitter,
  Provider,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
  StandardResolutionReasons,
  TrackingEventDetails,
} from "@openfeature/web-sdk";

import { BucketClient, InitOptions } from "@bucketco/browser-sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContextTranslationFn = (
  context?: EvaluationContext,
) => Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultContextTranslator(
  context?: EvaluationContext,
): Record<string, any> {
  if (!context) return {};
  return {
    user: {
      id: context["trackingKey"],
      email: context["email"],
      name: context["name"],
    },
    company: {
      id: context["companyId"],
      name: context["companyName"],
      plan: context["companyPlan"],
    },
  };
}

export class BucketBrowserSDKProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: "bucket-browser-provider",
  };

  private _client?: BucketClient;

  private readonly _clientOptions: InitOptions;
  private readonly _contextTranslator: ContextTranslationFn;

  public events = new OpenFeatureEventEmitter();

  private _status: ProviderStatus = ProviderStatus.NOT_READY;

  set status(status: ProviderStatus) {
    this._status = status;
  }

  get status() {
    return this._status;
  }

  get client() {
    return this._client;
  }

  constructor({
    contextTranslator,
    ...opts
  }: InitOptions & { contextTranslator?: ContextTranslationFn }) {
    this._clientOptions = opts;
    this._contextTranslator = contextTranslator || defaultContextTranslator;
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    const client = new BucketClient({
      ...this._clientOptions,
      ...this._contextTranslator(context),
    });

    try {
      await client.initialize();
      this.status = ProviderStatus.READY;
      this._client = client;
    } catch (e) {
      this.status = ProviderStatus.ERROR;
    }
  }

  onClose(): Promise<void> {
    if (this._client) {
      return this._client?.stop();
    }
    return Promise.resolve();
  }

  async onContextChange(
    _oldContext: EvaluationContext,
    newContext: EvaluationContext,
  ): Promise<void> {
    await this.initialize(newContext);
  }

  private resolveFeature<T extends null | boolean | string | number | object>(
    flagKey: string,
    defaultValue: T,
  ): ResolutionDetails<T> {
    const expType = typeof defaultValue;

    if (!this._client) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.DEFAULT,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        errorMessage: "Bucket client not initialized",
      } satisfies ResolutionDetails<T>;
    }

    const features = this._client.getFeatures();
    if (flagKey in features) {
      const feature = this._client.getFeature(flagKey);

      if (!feature.isEnabled) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DISABLED,
        };
      }

      if (expType === "boolean") {
        return {
          value: true as T,
          reason: StandardResolutionReasons.TARGETING_MATCH,
        };
      }

      if (!feature.config.key) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
        };
      }

      if (expType === "string") {
        return {
          value: feature.config.payload as T,
          reason: StandardResolutionReasons.TARGETING_MATCH,
        };
      }

      if (typeof feature.config.payload !== expType) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.ERROR,
          errorCode: ErrorCode.TYPE_MISMATCH,
          errorMessage: `Expected ${expType} but got ${typeof feature.config.payload}`,
        };
      }

      return {
        value: feature.config.payload as T,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      };
    }

    return {
      value: defaultValue,
      reason: StandardResolutionReasons.DEFAULT,
      errorCode: ErrorCode.FLAG_NOT_FOUND,
      errorMessage: `Flag ${flagKey} not found`,
    };
  }

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean) {
    return this.resolveFeature(flagKey, defaultValue);
  }

  resolveNumberEvaluation(flagKey: string, defaultValue: number) {
    return this.resolveFeature(flagKey, defaultValue);
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
  ) {
    return this.resolveFeature(flagKey, defaultValue);
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
  ): ResolutionDetails<string> {
    return this.resolveFeature(flagKey, defaultValue);
  }

  track(
    trackingEventName: string,
    _context?: EvaluationContext,
    trackingEventDetails?: TrackingEventDetails,
  ): void {
    if (!this._client) {
      this._clientOptions.logger?.error("client not initialized");
    }

    this._client
      ?.track(trackingEventName, trackingEventDetails)
      .catch((e: any) => {
        this._clientOptions.logger?.error("error tracking event", e);
      });
  }
}
