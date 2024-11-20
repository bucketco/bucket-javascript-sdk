import {
  ErrorCode,
  EvaluationContext,
  JsonValue,
  OpenFeatureEventEmitter,
  Paradigm,
  Provider,
  ResolutionDetails,
  ServerProviderStatus,
  StandardResolutionReasons,
  TrackingEventDetails,
} from "@openfeature/server-sdk";

import {
  BucketClient,
  ClientOptions,
  Context as BucketContext,
} from "@bucketco/node-sdk";

type ProviderOptions = ClientOptions & {
  contextTranslator?: (context: EvaluationContext) => BucketContext;
};

const defaultTranslator = (context: EvaluationContext): BucketContext => {
  const user = {
    id: context.targetingKey ?? context["id"]?.toString(),
    name: context["name"]?.toString(),
    email: context["email"]?.toString(),
    country: context["country"]?.toString(),
  };

  const company = {
    id: context["companyId"]?.toString(),
    name: context["companyName"]?.toString(),
  };

  return {
    user,
    company,
  };
};

export class BucketNodeProvider implements Provider {
  public readonly events = new OpenFeatureEventEmitter();

  private _client: BucketClient;

  private contextTranslator: (context: EvaluationContext) => BucketContext;

  public runsOn: Paradigm = "server";

  public status: ServerProviderStatus = ServerProviderStatus.NOT_READY;

  public metadata = {
    name: "bucket-node",
  };

  get client() {
    return this._client;
  }

  constructor({ contextTranslator, ...opts }: ProviderOptions) {
    this._client = new BucketClient(opts);
    this.contextTranslator = contextTranslator ?? defaultTranslator;
  }

  public async initialize(): Promise<void> {
    await this._client.initialize();
    this.status = ServerProviderStatus.READY;
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    const features = this._client.getFeatures(this.contextTranslator(context));

    const feature = features[flagKey];
    if (!feature) {
      return Promise.resolve({
        value: defaultValue,
        source: "bucket-node",
        flagKey,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: StandardResolutionReasons.ERROR,
      });
    }

    return Promise.resolve({
      value: feature.isEnabled,
      source: "bucket-node",
      flagKey,
      reason: StandardResolutionReasons.TARGETING_MATCH,
    });
  }
  resolveStringEvaluation(
    _flagKey: string,
    defaultValue: string,
  ): Promise<ResolutionDetails<string>> {
    return Promise.resolve({
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.GENERAL,
      errorMessage: "Bucket doesn't support string flags",
    });
  }
  resolveNumberEvaluation(
    _flagKey: string,
    defaultValue: number,
  ): Promise<ResolutionDetails<number>> {
    return Promise.resolve({
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.GENERAL,
      errorMessage: "Bucket doesn't support number flags",
    });
  }
  resolveObjectEvaluation<T extends JsonValue>(
    _flagKey: string,
    defaultValue: T,
  ): Promise<ResolutionDetails<T>> {
    return Promise.resolve({
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.GENERAL,
      errorMessage: "Bucket doesn't support object flags",
    });
  }

  track(
    trackingEventName: string,
    context?: EvaluationContext,
    trackingEventDetails?: TrackingEventDetails,
  ): void {
    const translatedContext = context
      ? this.contextTranslator(context)
      : undefined;

    const userId = translatedContext?.user?.id;
    if (!userId) {
      this._client.logger?.warn("No user ID provided for tracking event");
      return;
    }

    void this._client.track(String(userId), trackingEventName, {
      attributes: trackingEventDetails,
      companyId: translatedContext?.company?.id?.toString(),
    });
  }
}
