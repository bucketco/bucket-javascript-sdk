import slugify from "@sindresorhus/slugify";

export const genDTS = (keys: string[]) => {
  return /* ts */ `
// DO NOT EDIT THIS FILE. IT IS GENERATED BY THE BUCKET CLI AND WILL BE OVERWRITTEN.

const availableFeatures = [
  "${keys.join('",\n  "')}"
] as const;

type ArrayToRecord<T extends readonly string[]> = {
  [Key in T[number]]: boolean;
};

export type AvailableFeatures = ArrayToRecord<typeof availableFeatures>;

declare module "@bucketco/react-sdk" {
  interface Features extends AvailableFeatures {}
}
`.trim();
};

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
