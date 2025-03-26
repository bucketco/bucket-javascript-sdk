import { z } from "zod";

import { authRequest } from "../utils/auth.js";
import {
  booleanish,
  EnvironmentQuerySchema,
  PaginationQueryBaseSchema,
} from "../utils/schemas.js";
import {
  FunnelStep,
  PaginatedResponse,
  SatisfactionScore,
} from "../utils/types.js";

export type FeatureMetric = {
  funnelStep: FunnelStep | null;
  eventCount: number;
  firstUsed: string | null;
  lastUsed: string | null;
  frequency: number | null;
  satisfaction: SatisfactionScore;
};

export type CompanyName = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type Company = CompanyName & {
  firstSeen: string | null;
  lastSeen: string | null;
  userCount: number;
  eventCount: number;
  feedbackCount: number;
  attributes: Record<string, string>;
  featureMetrics: Record<string, FeatureMetric>;
};

export type CompaniesResponse = PaginatedResponse<Company>;

export const CompaniesSortByColumns = [
  "name",
  "id",
  "firstSeen",
  "lastSeen",
  "feedbackCount",
  "userCount",
] as const;

export const CompaniesSortBySchema = z
  .enum(CompaniesSortByColumns)
  .describe("Column to sort companies by");

export const CompaniesQuerySchema = EnvironmentQuerySchema.merge(
  PaginationQueryBaseSchema(),
)
  .extend({
    sortBy: CompaniesSortBySchema.default("name"),
    idNameFilter: z.string().optional(),
  })
  .strict();

export type CompaniesQuery = z.input<typeof CompaniesQuerySchema>;

export async function listCompanies(
  appId: string,
  query: CompaniesQuery,
): Promise<CompaniesResponse> {
  const { envId, ...body } = CompaniesQuerySchema.parse(query);
  return authRequest<CompaniesResponse>(`/apps/${appId}/companies/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: {
      envId,
    },
    body: JSON.stringify(body),
  });
}

export const CompanyFeatureAccessSchema = EnvironmentQuerySchema.extend({
  companyId: z.string().describe("Company ID"),
  featureKey: z.string().describe("Feature key"),
  isEnabled: booleanish.describe(
    "Set feature to enabled or disabled for the company.",
  ),
}).strict();

export type CompanyFeatureAccess = z.input<typeof CompanyFeatureAccessSchema>;

export async function companyFeatureAccess(
  appId: string,
  query: CompanyFeatureAccess,
): Promise<void> {
  const { envId, companyId, ...body } = CompanyFeatureAccessSchema.parse(query);
  return authRequest<void>(`/apps/${appId}/companies/${companyId}/features`, {
    method: "PATCH",
    params: {
      envId,
    },
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ features: [body] }),
  });
}
