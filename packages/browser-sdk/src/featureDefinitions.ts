export type ConfigDataType =
  | "string"
  | "number"
  | "boolean"
  | { [key: string]: ConfigDataType };

export type FeatureDefinitions = Readonly<
  Array<string | { key: string; config?: ConfigDataType }>
>;

export type StringTypeToTSType<C extends ConfigDataType> = C extends "string"
  ? string
  : C extends "number"
    ? number
    : C extends "boolean"
      ? boolean
      : C extends { [key: string]: ConfigDataType }
        ? { [K in keyof C]: StringTypeToTSType<C[K]> }
        : never;

export type ConfigType<Defs extends FeatureDefinitions, Key extends string> =
  Extract<Defs[number], { key: Key; config: any }> extends never
    ? undefined
    : StringTypeToTSType<
        Extract<Defs[number], { key: Key; config: any }>["config"]
      >;

export type FeatureKey<Defs extends FeatureDefinitions> =
  | Extract<Defs[number], string>
  | Extract<Defs[number], { key: string }>["key"];

/**
 * Define features for the SDK
 * @param features Feature definitions
 * @returns Feature definitions, ready to plug into the SDK
 */
export function defineFeatures<const TFeatures extends FeatureDefinitions>(
  features: TFeatures,
): TFeatures {
  return features;
}
