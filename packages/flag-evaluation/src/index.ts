import { createHash } from "node:crypto";

export interface Rule {
  contextFilter?: ContextFilter[];
  partialRolloutThreshold?: number;
  partialRolloutAttribute?: string;
  segment?: {
    id: string;
    attributeFilter: ContextFilter[];
  };
}

export type FlagData = {
  key: string;
  rules: Rule[];
};

export interface EvaluateFlagParams {
  context: Record<string, unknown>;
  flag: FlagData;
}

export interface EvaluateFlagResult {
  value: boolean;
  flag: FlagData;
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
  field: string;
  operator: ContextFilterOp;
  value?: string;
  values?: string[];
};

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

export async function evaluateFlag({
  context,
  flag,
}: EvaluateFlagParams): Promise<EvaluateFlagResult> {
  const flatContext = flattenJSON(context);

  const missingContextFieldsSet = new Set<string>();
  for (const rule of flag.rules) {
    rule.contextFilter
      ?.map((r) => r.field)
      .filter((field) => !(field in flatContext))
      .forEach((field) => missingContextFieldsSet.add(field));

    if (
      rule.partialRolloutAttribute &&
      !(rule.partialRolloutAttribute in flatContext)
    ) {
      missingContextFieldsSet.add(rule.partialRolloutAttribute);
    }
  }
  const missingContextFields = Array.from(missingContextFieldsSet);

  const ruleEvaluationResults = flag.rules.map((rule) => {
    return evaluateRuleWithContext({
      context: flatContext,
      rule,
      key: flag.key,
    });
  });

  const firstIdx = ruleEvaluationResults.findIndex(Boolean);
  return {
    value: firstIdx > -1,
    flag,
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

export function rejectedDueToPartialRollout({
  rule,
  context,
  key,
}: {
  rule: Rule;
  context: Record<string, string>;
  key: string;
}) {
  if (
    rule.partialRolloutAttribute === undefined ||
    rule.partialRolloutThreshold === undefined
  ) {
    return false;
  }

  // reject if the partial rollout attribute is not present in the context
  if (!(rule.partialRolloutAttribute in context)) {
    return true;
  }

  // not included in the partial rollout if the hash is above the threshold
  return (
    hashInt(`${key}.${context[rule.partialRolloutAttribute]}`) >
    rule.partialRolloutThreshold
  );
}

export function evaluateRuleWithContext({
  context,
  key,
  rule,
}: {
  key: string;
  context: Record<string, string>;
  rule: Rule;
}) {
  // transform segment attribute filter to context filter
  let contextFilter = rule.contextFilter || [];
  if (rule.segment) {
    contextFilter = rule.segment.attributeFilter.map(
      ({ field, operator, value, values }) => {
        if (field === "$company_id") {
          field = "id";
        }
        const valuesOut = values?.length ? values : [value || ""];
        return { field: `company.${field}`, operator, values: valuesOut };
      },
    );
  }
  const match = contextFilter.every((filter) => {
    if (!(filter.field in context)) {
      return false;
    }
    return evaluate(
      context[filter.field] as string,
      filter.operator,
      filter?.values?.length ? filter.values : [filter.value || ""],
    );
  });

  if (!match) {
    return false;
  }

  if (rejectedDueToPartialRollout({ rule, context, key })) {
    return false;
  }

  return true;
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
