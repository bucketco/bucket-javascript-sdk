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

import { Flag, InitOptions, ReflagClient } from "@reflag/browser-sdk";

export type ContextTranslationFn = (
  context?: EvaluationContext,
) => Record<string, any>;

export function defaultContextTranslator(
  context?: EvaluationContext,
): Record<string, any> {
  if (!context) return {};
  return {
    user: {
      id: context.targetingKey ?? context["userId"]?.toString(),
      email: context["email"]?.toString(),
      name: context["name"]?.toString(),
      avatar: context["avatar"]?.toString(),
      country: context["country"]?.toString(),
    },
    company: {
      id: context["companyId"]?.toString(),
      name: context["companyName"]?.toString(),
      plan: context["companyPlan"]?.toString(),
      avatar: context["companyAvatar"]?.toString(),
    },
  };
}

export class ReflagBrowserSDKProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: "reflag-browser-provider",
  };

  private _client?: ReflagClient;

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
    const client = new ReflagClient({
      ...this._clientOptions,
      ...this._contextTranslator(context),
    });

    try {
      await client.initialize();
      this.status = ProviderStatus.READY;
      this._client = client;
    } catch {
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

  private resolveFlag<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    resolveFn: (flag: Flag) => ResolutionDetails<T>,
  ): ResolutionDetails<T> {
    if (!this._client) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.DEFAULT,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        errorMessage: "Reflag client not initialized",
      } satisfies ResolutionDetails<T>;
    }

    const flags = this._client.getFlags();
    if (flagKey in flags) {
      return resolveFn(this._client.getFlag(flagKey));
    }

    return {
      value: defaultValue,
      reason: StandardResolutionReasons.DEFAULT,
      errorCode: ErrorCode.FLAG_NOT_FOUND,
      errorMessage: `Flag ${flagKey} not found`,
    };
  }

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean) {
    return this.resolveFlag(flagKey, defaultValue, (flag) => {
      if (typeof flag === "boolean") {
        return {
          value: flag,
          reason: StandardResolutionReasons.TARGETING_MATCH,
        };
      }

      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.TYPE_MISMATCH,
        errorMessage: `Expected flag ${flagKey} to be a boolean, but got ${typeof flag}`,
      };
    });
  }

  resolveNumberEvaluation(_flagKey: string, defaultValue: number) {
    return {
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.GENERAL,
      errorMessage:
        "Reflag doesn't support this method. Use `resolveObjectEvaluation` instead.",
    };
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
  ): ResolutionDetails<string> {
    return this.resolveFlag(flagKey, defaultValue, (flag) => {
      if (typeof flag === "object" && "key" in flag) {
        return {
          value: flag.key,
          variant: flag.key,
          reason: StandardResolutionReasons.TARGETING_MATCH,
        };
      }

      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.TYPE_MISMATCH,
        errorMessage: `Expected flag ${flagKey} to be a multi-variant, but got ${typeof flag}`,
      };
    });
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
  ) {
    return this.resolveFlag(flagKey, defaultValue, (flag) => {
      if (typeof flag === "object" && "key" in flag) {
        const expType = typeof defaultValue;
        const payloadType = typeof flag.payload;

        if (
          flag.payload === undefined ||
          flag.payload === null ||
          payloadType !== expType
        ) {
          return {
            value: defaultValue,
            reason: StandardResolutionReasons.ERROR,
            variant: flag.key,
            errorCode: ErrorCode.TYPE_MISMATCH,
            errorMessage: `Expected flag ${flagKey} to be a multi-variant with payload of type \`${expType}\` but got \`${payloadType}\`.`,
          };
        }

        return {
          value: flag.payload,
          variant: flag.key,
          reason: StandardResolutionReasons.TARGETING_MATCH,
        };
      }

      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.TYPE_MISMATCH,
        errorMessage: `Expected flag ${flagKey} to be a multi-variant, but got ${typeof flag}`,
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

/**
 * @deprecated
 *
 * Use ReflagBrowserSDKProvider instead
 */
export const BucketBrowserSDKProvider = ReflagBrowserSDKProvider;
