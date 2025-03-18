import { z } from "zod";

export const sortTypeSchema = z.enum(["flat", "hierarchical"]);

export const booleanish = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return Boolean(value);
}, z.boolean()) as z.ZodEffects<z.ZodBoolean, boolean, boolean>;

export const PaginationQueryBaseSchema = (
  {
    sortOrder = "asc",
    pageIndex = 0,
    pageSize = 20,
  }: {
    sortOrder?: "asc" | "desc";
    pageIndex?: number;
    pageSize?: number;
  } = {
    sortOrder: "asc",
    pageIndex: 0,
    pageSize: 20,
  },
) =>
  z.object({
    sortOrder: z.enum(["asc", "desc"]).default(sortOrder),
    pageIndex: z.coerce.number().int().nonnegative().default(pageIndex),
    pageSize: z.coerce
      .number()
      .int()
      .nonnegative()
      .min(1)
      .max(100)
      .default(pageSize),
  });

export const EnvironmentQuerySchema = (def?: string) =>
  z
    .object({
      envId: def ? z.string().min(1).default(def) : z.string().min(1),
    })
    .strict();

export const ExternalIdSchema = z.string().nonempty().max(256);
