// Simplified recursive type definition
type JSONPrimitive =
  | number
  | string
  | boolean
  | null
  | JSONPrimitive[]
  | { [key: string]: JSONPrimitive };

// Type AST to represent TypeScript types
export type TypeAST =
  | { kind: "primitive"; type: string }
  | { kind: "array"; elementType: TypeAST }
  | {
      kind: "object";
      properties: { key: string; type: TypeAST; optional: boolean }[];
    }
  | { kind: "union"; types: TypeAST[] };

// Convert JSON value to TypeAST
export function toTypeAST(value: JSONPrimitive, path: string[] = []): TypeAST {
  if (value === null) return { kind: "primitive", type: "null" };

  if (Array.isArray(value)) {
    return {
      kind: "array",
      elementType: value.length
        ? toTypeAST(value[0], [...path, "0"])
        : { kind: "primitive", type: "any" },
    };
  }

  if (typeof value === "object") {
    return {
      kind: "object",
      properties: Object.entries(value).map(([key, val]) => ({
        key,
        type: toTypeAST(val, [...path, key]),
        optional: false,
      })),
    };
  }

  return { kind: "primitive", type: typeof value };
}

// Merge multiple TypeASTs into one
export function mergeTypeASTs(types: TypeAST[]): TypeAST {
  if (types.length === 0) return { kind: "primitive", type: "any" };
  if (types.length === 1) return types[0];

  // Group ASTs by kind
  const byKind = {
    primitive: types.filter((t) => t.kind === "primitive"),
    array: types.filter((t) => t.kind === "array"),
    object: types.filter((t) => t.kind === "object"),
  };

  // Create a union for mixed kinds
  const hasMixedKinds =
    (byKind.primitive.length > 0 &&
      (byKind.array.length > 0 || byKind.object.length > 0)) ||
    (byKind.array.length > 0 && byKind.object.length > 0);

  if (hasMixedKinds) {
    return { kind: "union", types };
  }

  // Handle primitives
  if (byKind.primitive.length === types.length) {
    const uniqueTypes = [...new Set(byKind.primitive.map((p) => p.type))];
    return uniqueTypes.length === 1
      ? { kind: "primitive", type: uniqueTypes[0] }
      : {
          kind: "union",
          types: uniqueTypes.map((type) => ({ kind: "primitive", type })),
        };
  }

  // Merge arrays
  if (byKind.array.length === types.length) {
    return {
      kind: "array",
      elementType: mergeTypeASTs(byKind.array.map((a) => a.elementType)),
    };
  }

  // Merge objects
  if (byKind.object.length === types.length) {
    // Get all unique property keys
    const allKeys = [
      ...new Set(
        byKind.object.flatMap((obj) => obj.properties.map((p) => p.key)),
      ),
    ];

    // Merge properties with same keys
    const mergedProperties = allKeys.map((key) => {
      const props = byKind.object
        .map((obj) => obj.properties.find((p) => p.key === key))
        .filter(Boolean) as { key: string; type: TypeAST; optional: boolean }[];

      return {
        key,
        type: mergeTypeASTs(props.map((p) => p.type)),
        optional: byKind.object.some(
          (obj) => !obj.properties.some((p) => p.key === key),
        ),
      };
    });

    return { kind: "object", properties: mergedProperties };
  }

  // Fallback
  return { kind: "primitive", type: "any" };
}

// Stringify TypeAST to TypeScript type declaration
export function stringifyTypeAST(ast: TypeAST, nestLevel = 0): string {
  const indent = " ".repeat(nestLevel * 2);
  const nextIndent = " ".repeat((nestLevel + 1) * 2);

  switch (ast.kind) {
    case "primitive":
      return ast.type;

    case "array":
      return `(${stringifyTypeAST(ast.elementType, nestLevel)})[]`;

    case "object":
      if (ast.properties.length === 0) return "{}";

      return `{\n${ast.properties
        .map(
          ({ key, optional, type }) =>
            `${nextIndent}${key}${optional ? "?" : ""}: ${stringifyTypeAST(
              type,
              nestLevel + 1,
            )}`,
        )
        .join(",\n")}\n${indent}}`;

    case "union":
      if (ast.types.length === 0) return "any";
      if (ast.types.length === 1)
        return stringifyTypeAST(ast.types[0], nestLevel);
      return ast.types
        .map((type) => stringifyTypeAST(type, nestLevel))
        .join(" | ");
  }
}

// Convert JSON array to TypeScript type
export function JSONToType(json: JSONPrimitive[]): string | null {
  if (!json.length) return null;

  return stringifyTypeAST(mergeTypeASTs(json.map((item) => toTypeAST(item))));
}
