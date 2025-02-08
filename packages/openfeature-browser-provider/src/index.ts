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

import { BucketClient, Feature, InitOptions } from "@bucketco/browser-sdk";

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

  private resolveFeature<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    resolveFn: (feature: Feature) => ResolutionDetails<T>,
  ): ResolutionDetails<T> {
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
      return resolveFn(this._client.getFeature(flagKey));
    }

    return {
      value: defaultValue,
      reason: StandardResolutionReasons.DEFAULT,
      errorCode: ErrorCode.FLAG_NOT_FOUND,
      errorMessage: `Flag ${flagKey} not found`,
    };
  }

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean) {
    return this.resolveFeature(flagKey, defaultValue, (feature) => {
      return {
        value: feature.isEnabled,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      };
    });
  }

  resolveNumberEvaluation(_: string, defaultValue: number) {
    return {
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.GENERAL,
      errorMessage:
        "Bucket doesn't support this method. Use `resolveObjectEvaluation` instead.",
    };
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
  ) {
    return this.resolveFeature(flagKey, defaultValue, (feature) => {
      const expType = typeof defaultValue;
      const payload = feature.config?.payload;

      const payloadType = payload === null ? "null" : typeof payload;

      if (payloadType !== expType) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.ERROR,
          errorCode: ErrorCode.TYPE_MISMATCH,
          errorMessage: `Expected remote config payload of type \`${expType}\` but got \`${payloadType}\`.`,
        };
      }

      return {
        value: payload,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      };
    });
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
  ): ResolutionDetails<string> {
    return this.resolveFeature(flagKey, defaultValue, (feature) => {
      if (!feature.config.key) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
        };
      }

      return {
        value: feature.config.key as string,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      };
    });
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
