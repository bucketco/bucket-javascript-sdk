export type ParamType = string | number | boolean | Date;

export type PaginatedResponse<T> = {
  data: T[];
  metadata: Record<string, any>;
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
};
