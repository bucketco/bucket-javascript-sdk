import { createHash } from "node:crypto";

export type FilterClass = {
  type: string;
};

export type FilterGroup<T extends FilterClass> = {
  type: "group";
  operator: "and" | "or";
  filters: FilterTree<T>[];
};

export type FilterNegation<T extends FilterClass> = {
  type: "negation";
  filter: FilterTree<T>;
};

export type FilterTree<T extends FilterClass> =
  | FilterGroup<T>
  | FilterNegation<T>
  | T;

export interface Rule {
  filter: RuleFilter;
}

export type FeatureData = {
  key: string;
  targeting: { rules: Rule[] };
};

export interface EvaluateTargetingParams {
  context: Record<string, unknown>;
  feature: FeatureData;
}

export interface EvaluateTargetingResult {
  value: boolean;
  feature: FeatureData;
  context: Record<string, any>;
  ruleEvaluationResults: boolean[];
  reason?: string;
  missingContextFields?: string[];
}

type ContextFilterOp =
  | "IS"
  | "IS_NOT"
  | "ANY_OF"
  | "NOT_ANY_OF"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "GT"
  | "LT"
  | "AFTER"
  | "BEFORE"
  | "SET"
  | "NOT_SET"
  | "IS_TRUE"
  | "IS_FALSE";

export type ContextFilter = {
  type: "context";
  field: string;
  operator: ContextFilterOp;
  values?: string[];
};

export type PercentageRolloutFilter = {
  type: "rolloutPercentage";
  key: string;
  partialRolloutAttribute: string;
  partialRolloutThreshold: number;
};

export type ConstantFilter = {
  type: "constant";
  value: boolean;
};

export type RuleFilter = FilterTree<
  ContextFilter | PercentageRolloutFilter | ConstantFilter
>;

export function flattenJSON(data: object): Record<string, string> {
  if (Object.keys(data).length === 0) return {};
  const result: Record<string, any> = {};
  function recurse(cur: any, prop: string) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      const l = cur.length;
      for (let i = 0; i < l; i++)
        recurse(cur[i], prop ? prop + "." + i : "" + i);
      if (l == 0) result[prop] = [];
    } else {
      let isEmpty = true;
      for (const p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + "." + p : p);
      }
      if (isEmpty) result[prop] = {};
    }
  }
  recurse(data, "");
  return result;
}

export function unflattenJSON(data: Record<string, any>) {
  const result: Record<string, any> = {};

  for (const i in data) {
    const keys = i.split(".");
    keys.reduce((acc, key, index) => {
      if (index === keys.length - 1) {
        acc[key] = data[i];
      } else if (!acc[key]) {
        acc[key] = {};
      }
      return acc[key];
    }, result);
  }

  return result;
}

export function evaluateTargeting({
  context,
  feature,
}: EvaluateTargetingParams): EvaluateTargetingResult {
  const flatContext = flattenJSON(context);

  const missingContextFieldsSet = new Set<string>();

  const ruleEvaluationResults = feature.targeting.rules.map((rule) =>
    evaluateRecursively(rule.filter, flatContext, missingContextFieldsSet),
  );
  const missingContextFields = Array.from(missingContextFieldsSet);

  const firstIdx = ruleEvaluationResults.findIndex(Boolean);
  return {
    value: firstIdx > -1,
    feature,
    context: flatContext,
    ruleEvaluationResults,
    reason: firstIdx > -1 ? `rule #${firstIdx} matched` : "no matched rules",
    missingContextFields,
  };
}

export function hashInt(hashInput: string) {
  // 1. hash the key and the partial rollout attribute
  // 2. take 20 bits from the hash and divide by 2^20 - 1 to get a number between 0 and 1
  // 3. multiply by 100000 to get a number between 0 and 100000 and compare it to the threshold
  //
  // we only need 20 bits to get to 100000 because 2^20 is 1048576
  const hash =
    createHash("sha256").update(hashInput, "utf-8").digest().readUInt32LE(0) &
    0xfffff;
  return Math.floor((hash / 0xfffff) * 100000);
}

function evaluateRecursively(
  filter: RuleFilter,
  context: Record<string, string>,
  missingContextFieldsSet: Set<string>,
): boolean {
  switch (filter.type) {
    case "constant":
      return filter.value;
    case "context":
      if (!(filter.field in context)) {
        missingContextFieldsSet.add(filter.field);
        return false;
      }

      return evaluate(
        context[filter.field],
        filter.operator,
        filter.values || [],
      );
    case "rolloutPercentage": {
      if (!(filter.partialRolloutAttribute in context)) {
        missingContextFieldsSet.add(filter.partialRolloutAttribute);
        return false;
      }

      const hashVal = hashInt(
        `${filter.key}.${context[filter.partialRolloutAttribute]}`,
      );

      return hashVal < filter.partialRolloutThreshold;
    }
    case "group":
      return filter.filters.reduce((acc, current) => {
        if (filter.operator === "and") {
          return (
            acc &&
            evaluateRecursively(current, context, missingContextFieldsSet)
          );
        }
        return (
          acc || evaluateRecursively(current, context, missingContextFieldsSet)
        );
      }, filter.operator === "and");
    case "negation":
      return !evaluateRecursively(
        filter.filter,
        context,
        missingContextFieldsSet,
      );
    default:
      return false;
  }
}

export function evaluate(
  fieldValue: string,
  op: ContextFilterOp,
  values: string[],
) {
  const value = values[0];

  switch (op) {
    case "CONTAINS":
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    case "NOT_CONTAINS":
      return !fieldValue.toLowerCase().includes(value.toLowerCase());
    case "GT":
      if (isNaN(Number(fieldValue)) || isNaN(Number(value))) {
        // TODO: return error instead? used logger previously
        console.error(
          `GT operator requires numeric values: ${fieldValue}, ${value}`,
        );
        return false;
      }
      return fieldValue > value;
    case "LT":
      if (isNaN(Number(fieldValue)) || isNaN(Number(value))) {
        console.error(
          `LT operator requires numeric values: ${fieldValue}, ${value}`,
        );
        return false;
      }
      return fieldValue < value;
    case "AFTER":
    case "BEFORE": {
      // more/less than `value` days ago
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(value));
      const fieldValueDate = new Date(fieldValue).getTime();

      return op === "AFTER"
        ? fieldValueDate > daysAgo.getTime()
        : fieldValueDate < daysAgo.getTime();
    }
    case "SET":
      return fieldValue != "";
    case "IS":
      return fieldValue === value;
    case "IS_NOT":
      return fieldValue !== value;
    case "ANY_OF":
      return values.includes(fieldValue);
    case "NOT_ANY_OF":
      return !values.includes(fieldValue);
    case "IS_TRUE":
      return fieldValue == "true";
    case "IS_FALSE":
      return fieldValue == "false";
    default:
      console.error(`unknown operator: ${op}`);
      return false;
  }
}
