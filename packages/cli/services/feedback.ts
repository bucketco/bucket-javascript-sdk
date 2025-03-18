import { z } from "zod";

import { authRequest } from "../utils/auth.js";
import {
  EnvironmentQuerySchema,
  ExternalIdSchema,
  PaginationQueryBaseSchema,
} from "../utils/schemas.js";
import { PaginatedResponse } from "../utils/types.js";

export const FunnelStepList = [
  "company",
  "segment",
  "tried",
  "adopted",
  "retained",
] as const;

export type FunnelStep = (typeof FunnelStepList)[number];

export type FeedbackSource = "api" | "manual" | "prompt" | "sdk" | "widget";

export type SatisfactionScore = 0 | 1 | 2 | 3 | 4 | 5;

export type Feedback = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  companyAvatarUrl: string | null;
  companyFunnelStep: FunnelStep | null;
  featureId: string;
  featureName: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  question: string | null;
  score: SatisfactionScore;
  comment: string | null;
  source: FeedbackSource | null;
  timestamp: string;
  updatedAt: string;
};

export type FeedbackResponse = PaginatedResponse<Feedback>;

export const SatisfactionScoreFilterSchema = z.coerce
  .number()
  .int()
  .gte(0)
  .lte(5)
  .array();

export const FeedbackListSortByColumns = [
  "score",
  "comment",
  "userName",
  "userEmail",
  "companyName",
  "companyFunnelStep",
  "timestamp",
] as const;
export const FeedbackListSortBySchema = z.enum(FeedbackListSortByColumns);
export type FeedbackListSortBy = z.infer<typeof FeedbackListSortBySchema>;

export const FeedbackQuerySchema = EnvironmentQuerySchema()
  .merge(
    PaginationQueryBaseSchema({
      sortOrder: "desc",
    }),
  )
  .extend({
    sortBy: FeedbackListSortBySchema.default("timestamp"),
    satisfaction: SatisfactionScoreFilterSchema.optional().default([
      0, 1, 2, 3, 4, 5,
    ]),
    featureId: z.string().length(14).optional(),
    companyId: ExternalIdSchema.optional(),
    funnelSteps: z
      .enum(FunnelStepList)
      .array()
      .optional()
      .default(["company", "segment", "tried", "adopted", "retained"]),
    segmentId: z.string().length(14).optional(),
  })
  .strict();
export type FeedbackQuery = z.input<typeof FeedbackQuerySchema>;

export async function listFeedback(
  appId: string,
  query: FeedbackQuery,
): Promise<FeedbackResponse> {
  return authRequest<FeedbackResponse>(`/apps/${appId}/feedback`, {
    params: FeedbackQuerySchema.parse(query),
  });
}
