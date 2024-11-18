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
  Tracking,
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

export class BucketBrowserSDKProvider implements Provider, Tracking {
  readonly metadata: ProviderMetadata = {
    name: "bucket-browser-provider",
  };

  private _client?: BucketClient;

  private _clientOptions: InitOptions;
  private _contextTranslator: ContextTranslationFn;

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

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
  ): ResolutionDetails<boolean> {
    if (!this._client)
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.DEFAULT,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
      } satisfies ResolutionDetails<boolean>;

    const features = this._client.getFeatures();
    if (flagKey in features) {
      const feature = this._client.getFeature(flagKey);
      return {
        value: feature.isEnabled,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      } satisfies ResolutionDetails<boolean>;
    }

    return {
      value: defaultValue,
      reason: StandardResolutionReasons.DEFAULT,
    } satisfies ResolutionDetails<boolean>;
  }

  resolveNumberEvaluation(
    _flagKey: string,
    defaultValue: number,
  ): ResolutionDetails<number> {
    return {
      value: defaultValue,
      errorCode: ErrorCode.TYPE_MISMATCH,
      reason: StandardResolutionReasons.ERROR,
      errorMessage: "Bucket doesn't support number flags",
    };
  }

  resolveObjectEvaluation<T extends JsonValue>(
    _flagKey: string,
    defaultValue: T,
  ): ResolutionDetails<T> {
    return {
      value: defaultValue,
      errorCode: ErrorCode.TYPE_MISMATCH,
      reason: StandardResolutionReasons.ERROR,
      errorMessage: "Bucket doesn't support object flags",
    };
  }

  resolveStringEvaluation(
    _flagKey: string,
    defaultValue: string,
  ): ResolutionDetails<string> {
    return {
      value: defaultValue,
      errorCode: ErrorCode.TYPE_MISMATCH,
      reason: StandardResolutionReasons.ERROR,
      errorMessage: "Bucket doesn't support string flags",
    };
  }

  track(
    trackingEventName: string,
    trackingEventDetails?: TrackingEventDetails,
  ): void {
    this._client?.track(trackingEventName, trackingEventDetails).catch((e) => {
      this._clientOptions.logger?.error("error tracking event", e);
    });
  }
}
