import type { Ref } from "vue";

import type {
  Flag,
  InitOptions,
  ReflagClient,
  ReflagContext,
} from "@reflag/browser-sdk";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Flags {}

type MultiVariateFlagSignature = {
  payload: any;
};

/**
 * Describes a collection of evaluated flags.
 *
 * @remarks
 * This types falls back to a generic Record<string, Flag> if the Flags interface
 * has not been extended.
 */
export type TypedFlags = keyof Flags extends never
  ? Record<string, Flag>
  : {
      [TKey in keyof Flags]: Flags[TKey] extends MultiVariateFlagSignature
        ? {
            key: string;
            payload: Flags[TKey]["payload"];
          }
        : boolean;
    };

/**
 * The key of a flag.
 */
export type FlagKey = keyof TypedFlags;

/**
 * @internal
 *
 * The context type for the ReflagProvider component.
 */
export interface ProviderContextType {
  client: Ref<ReflagClient>;
  isLoading: Ref<boolean>;
  updatedCount: Ref<number>;
  provider: boolean;
}

/**
 * Props for the ReflagProvider component.
 */
export type ReflagProps = ReflagContext &
  InitOptions & {
    /**
     * Whether to enable debug mode.
     */
    debug?: boolean;

    /**
     * New ReflagClient constructor.
     *
     * @internal
     */
    newReflagClient?: (
      ...args: ConstructorParameters<typeof ReflagClient>
    ) => ReflagClient;
  };
