import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { evaluate, evaluateTargeting, FeatureData, hashInt } from "../src";

const feature: FeatureData = {
  key: "feature",
  targeting: {
    rules: [
      {
        filter: {
          type: "group",
          operator: "and",
          filters: [
            {
              type: "context",
              field: "company.id",
              operator: "IS",
              values: ["company1"],
            },
            {
              type: "rolloutPercentage",
              key: "flag",
              partialRolloutAttribute: "company.id",
              partialRolloutThreshold: 100000,
            },
          ],
        },
      },
    ],
  },
};

describe("evaluate feature targeting integration ", () => {
  it("evaluates all kinds of filters", async () => {
    // Feature with context filter targeting, rollout percentage AND and OR groups, negation and constant filters
    const featureWithAllFilterTypes: FeatureData = {
      key: "feature",
      targeting: {
        rules: [
          {
            filter: {
              type: "group",
              operator: "and",
              filters: [
                {
                  type: "context",
                  field: "company.id",
                  operator: "IS",
                  values: ["company1"],
                },
                {
                  type: "rolloutPercentage",
                  key: "flag",
                  partialRolloutAttribute: "company.id",
                  partialRolloutThreshold: 99999,
                },
                {
                  type: "group",
                  operator: "or",
                  filters: [
                    {
                      type: "context",
                      field: "company.id",
                      operator: "IS",
                      values: ["company2"],
                    },
                    {
                      type: "negation",
                      filter: {
                        type: "context",
                        field: "company.id",
                        operator: "IS",
                        values: ["company3"],
                      },
                    },
                  ],
                },
                {
                  type: "negation",
                  filter: {
                    type: "constant",
                    value: false,
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const context = {
      "company.id": "company1",
    };

    const res = evaluateTargeting({
      feature: featureWithAllFilterTypes,
      context,
    });

    expect(res).toEqual({
      value: true,
      context: {
        "company.id": "company1",
      },
      feature: featureWithAllFilterTypes,
      missingContextFields: [],
      reason: "rule #0 matched",
      ruleEvaluationResults: [true],
    });
  });

  it("evaluates flag when there's no matching rule", async () => {
    const res = evaluateTargeting({
      feature,
      context: {
        company: {
          id: "wrong value",
        },
      },
    });

    expect(res).toEqual({
      value: false,
      context: {
        "company.id": "wrong value",
      },
      feature,
      missingContextFields: [],
      reason: "no matched rules",
      ruleEvaluationResults: [false],
    });
  });

  it("evaluates targeting when there's a matching rule", async () => {
    const context = {
      company: {
        id: "company1",
      },
    };
    const res = evaluateTargeting({
      feature,
      context,
    });
    expect(res).toEqual({
      value: true,
      context: {
        "company.id": "company1",
      },
      feature,
      missingContextFields: [],
      reason: "rule #0 matched",
      ruleEvaluationResults: [true],
    });
  });

  it("evaluates flag with missing values", async () => {
    const featureWithSegmentRule: FeatureData = {
      key: "feature",
      targeting: {
        rules: [
          {
            filter: {
              type: "group",
              operator: "and",
              filters: [
                {
                  type: "context",
                  field: "some_field",
                  operator: "IS",
                  values: [""],
                },
                {
                  type: "rolloutPercentage",
                  key: "flag",
                  partialRolloutAttribute: "some_field",
                  partialRolloutThreshold: 99000,
                },
              ],
            },
          },
        ],
      },
    };

    const res = evaluateTargeting({
      feature: featureWithSegmentRule,
      context: {
        some_field: "",
      },
    });

    expect(res).toEqual({
      context: {
        some_field: "",
      },
      value: true,
      feature: featureWithSegmentRule,
      missingContextFields: [],
      reason: "rule #0 matched",
      ruleEvaluationResults: [true],
    });
  });

  it("returns list of missing context keys ", async () => {
    const res = evaluateTargeting({
      feature: feature,
      context: {},
    });
    expect(res).toEqual({
      context: {},
      value: false,
      reason: "no matched rules",
      feature,
      missingContextFields: ["company.id"],
      ruleEvaluationResults: [false],
    });
  });

  it("fails evaluation and includes key in missing keys when rollout attribute is missing from context", async () => {
    const myfeature = {
      key: "myfeature",
      targeting: {
        rules: [
          {
            filter: {
              type: "rolloutPercentage" as const,
              key: "myfeature",
              partialRolloutAttribute: "happening.id",
              partialRolloutThreshold: 50000,
            },
          },
        ],
      },
    };
    const res = evaluateTargeting({
      feature: myfeature,
      context: {},
    });
    expect(res).toEqual({
      feature: myfeature,
      context: {},
      value: false,
      reason: "no matched rules",
      missingContextFields: ["happening.id"],
      ruleEvaluationResults: [false],
    });
  });
});

describe("operator evaluation", () => {
  beforeAll(() => {
    vi.useFakeTimers().setSystemTime(new Date("2024-01-10"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const tests = [
    ["value", "IS", "value", true],
    ["value", "IS", "wrong value", false],
    ["value", "IS_NOT", "value", false],
    ["value", "IS_NOT", "wrong value", true],

    ["value", "ANY_OF", "value", true],
    ["value", "ANY_OF", "nope", false],
    ["value", "NOT_ANY_OF", "value", false],
    ["value", "NOT_ANY_OF", "nope", true],

    ["value", "IS_TRUE", "", false],
    ["value", "IS_FALSE", "", false],

    ["value", "SET", "", true],
    ["", "SET", "", false],

    // non numeric values should return false
    ["value", "GT", "value", false],
    ["value", "GT", "0", false],
    ["1", "GT", "0", true],

    ["value", "LT", "value", false],
    ["value", "LT", "0", false],
    ["0", "LT", "1", true],

    ["start VALUE end", "CONTAINS", "value", true],
    ["alue", "CONTAINS", "value", false],
    ["start VALUE end", "NOT_CONTAINS", "value", false],
    ["alue", "NOT_CONTAINS", "value", true],

    // today is 2024-01-10
    // 2024-01-10 - 5 days = 2024-01-05
    ["2024-01-15", "BEFORE", "5", false], // 2024-01-15 is before 2024-01-05 = false
    ["2024-01-15", "AFTER", "5", true], // 2024-01-15 is after  2024-01-05 = true
    ["2024-01-01", "BEFORE", "5", true], // 2024-01-01 is before 2024-01-05 = true
    ["2024-01-01", "AFTER", "5", false], // 2024-01-01 is after 2024-01-05 = false
  ] as const;

  for (const [value, op, filterValue, expected] of tests) {
    it(`evaluates '${value}' ${op} 2024-01-10 minus ${filterValue} days = ${expected}`, () => {
      const res = evaluate(value, op, [filterValue]);
      expect(res).toEqual(expected);
    });
  }
});

describe("rollout hash", () => {
  const tests = [
    ["EEuoT8KShb", 38026],
    ["h7BOkvks5W", 81440],
    ["IZeSn3LCfJ", 80149],
    ["jxYGR0k2eG", 70348],
    ["VnaiKHgo1E", 82432],
    ["I3R27J9tGN", 88564],
    ["JoCeRRF5wm", 67104],
    ["D9yQyxGKlc", 90226],
    ["gvfTO4h4Je", 98400],
    ["zF5iPhvJuw", 53236],
    ["jMBqhV9Lzr", 99182],
    ["HQtiM6m2sM", 22123],
    ["O4VD9CdVMq", 72700],
    ["lEI48g7tLX", 46266],
    ["s7sOvfaOQ3", 57198],
    ["WuCAxrsjwT", 12755],
    ["1UIruKyifl", 50838],
    ["f8Y0N3i97C", 42372],
    ["rA57gcwaXG", 44337],
    ["5zNThaRQuB", 33221],
    ["uLIHKFgFU2", 49832],
    ["Dq29RMUKnK", 75136],
    ["pNIWi69N81", 21686],
    ["2lJMZxGGwf", 7747],
    ["vJHqCdZmo5", 11319],
    ["qgDRZ2LFvu", 91245],
    ["iWSiN2Jcad", 13365],
    ["FTCF9ZRnIY", 65642],
    ["WxsLfsrQNw", 41778],
    ["9HgMS79hrG", 88627],
    ["BXrIz1JIiP", 44341],
    ["oMtRltWl6T", 85415],
    ["FKP9myTjTo", 5059],
    ["fqlZoZ4PhD", 91346],
    ["ohtHmrXWOB", 45678],
    ["X7xh1uYeTU", 96239],
    ["zXe7HkAtjC", 25732],
    ["AnAZ1gugGv", 62481],
    ["0mfxv840GT", 27268],
    ["eins7hyIvx", 70954],
    ["es9Wkj86PO", 48575],
    ["g3AZn8zuTe", 44126],
    ["NHzNfl4ABW", 63844],
    ["0JZw2gHPg2", 53707],
    ["GKHMJ46sT9", 17572],
    ["ZHEpl9s0kN", 59526],
    ["wSMTYbrr75", 26396],
    ["0WEJv16LYd", 94865],
    ["dxV85hJ5t3", 96945],
    ["00d1uypkKy", 38988],
  ] as const;

  for (const [input, expected] of tests) {
    it(`evaluates '${input}' = ${expected}`, () => {
      const res = hashInt(input);
      expect(res).toEqual(expected);
    });
  }
});
