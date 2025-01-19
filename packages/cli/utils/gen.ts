import slugify from "@sindresorhus/slugify";

export type Datatype =
  | "string"
  | "boolean"
  | "number"
  | { [key: string]: Datatype };

export type FeatureDef = {
  key: string;
  access: boolean;
  config?: Datatype;
};

export type OutputType = "browser" | "react";

const indentString = (str: string, count: number): string =>
  str.replace(/^/gm, "  ".repeat(count));

function maybeStringify(value: any, stringify: boolean): string {
  return stringify ? `"${value}"` : value;
}

function output(value: any, stringTypes: boolean, indent: number = 0): string {
  if (value === "boolean") return maybeStringify("boolean", stringTypes);
  if (value === "string") return maybeStringify("string", stringTypes);
  if (value === "number") return maybeStringify("number", stringTypes);

  if (Array.isArray(value))
    return indentString(
      `[\n` +
        value
          .map((v: any) => indentString(output(v, stringTypes, indent), 1))
          .join(", \n") +
        `\n]\n`,
      indent,
    );

  if (typeof value === "object")
    return indentString(
      `{\n` +
        indentString(
          Object.entries(value)
            .map(([k, v]) => `${k}: ${output(v, stringTypes)}`)
            .join(", \n"),
          1,
        ) +
        `\n}`,
      indent,
    );

  return JSON.stringify(value);
}

function generateTypescriptOutput(features: FeatureDef[], react: boolean) {
  const browserOutput = /* ts */ `
// DO NOT EDIT THIS FILE. IT IS GENERATED BY THE BUCKET CLI AND WILL BE OVERWRITTEN.

export const generatedFeatures = ${output(features, true).trimEnd()} as const;

`;

  const reactOutput = `
declare module "@bucket/react-sdk" ${output(
    Object.fromEntries(
      features.map((feature) => [
        feature.key,
        {
          key: feature.key,
          access: feature.access,
          config: feature.config,
        },
      ]),
    ),
    false,
  )}
  `.trim();
  return react ? browserOutput + "\n\n" + reactOutput : browserOutput;
}

export function genDTS(output: OutputType, features: FeatureDef[]): string {
  switch (output) {
    case "react":
      return generateTypescriptOutput(features, true);
    case "browser":
      return generateTypescriptOutput(features, false);
    default:
      throw new Error("Invalid SDK type when generating types.");
  }
}

export function genFeatureKey(input: string, existingKeys: string[]): string {
  const keySlug = slugify(input);

  if (!existingKeys.includes(keySlug)) {
    return keySlug;
  } else {
    const lastPart = keySlug.split("-").pop();

    if (!lastPart || isNaN(Number(lastPart))) {
      return `${keySlug}-1`;
    } else {
      const base = keySlug.slice(0, keySlug.length - lastPart.length);
      const newNumber = Number(lastPart) + 1;
      return `${base}${newNumber}`;
    }
  }
}
