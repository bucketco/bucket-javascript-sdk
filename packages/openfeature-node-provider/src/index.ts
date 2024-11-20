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
  const userId = context.targetingKey ?? context["id"];
  const user = userId
    ? {
        id: String(userId),
        name: context["name"]?.toString(),
        email: context["email"]?.toString(),
        country: context["country"]?.toString(),
      }
    : undefined;

  const company = context["companyId"]
    ? {
        id: String(context["companyId"]),
        name: context["companyName"],
      }
    : undefined;

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

  public async initialize(): Promise<void> {
    await this._client.initialize();
    this.status = ServerProviderStatus.READY;
  }

  public async onClose(): Promise<void> {
    await this._client.flush();
  }
}
