import { z } from "zod";

import { authRequest } from "../utils/auth.js";
import {
  EnvironmentQuerySchema,
  PaginationQueryBaseSchema,
} from "../utils/schemas.js";
import { PaginatedResponse } from "../utils/types.js";

export type UserName = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type User = UserName & {
  firstSeen: string | null;
  lastSeen: string | null;
  eventCount: number;
};

export type UsersResponse = PaginatedResponse<User>;

export const UsersSortByColumns = [
  "id",
  "name",
  "email",
  "avatarUrl",
  "firstSeen",
  "lastSeen",
  "eventCount",
] as const;

export const UsersSortBySchema = z
  .enum(UsersSortByColumns)
  .describe("Column to sort users by");

export const UsersQuerySchema = EnvironmentQuerySchema.merge(
  PaginationQueryBaseSchema(),
)
  .extend({
    sortBy: UsersSortBySchema.default("name"),
  })
  .strict();

export type UsersQuery = z.input<typeof UsersQuerySchema>;

export async function listUsers(
  appId: string,
  query: UsersQuery,
): Promise<UsersResponse> {
  return authRequest<UsersResponse>(`/apps/${appId}/users`, {
    params: UsersQuerySchema.parse(query),
  });
}
