export interface CompanyContext {
  id: string | number | undefined;
  name?: string | undefined;
  [key: string]: string | number | undefined;
}

export interface UserContext {
  id: string | number | undefined;
  name?: string | undefined;
  email?: string | undefined;
  [key: string]: string | number | undefined;
}

export interface BucketContext {
  company?: CompanyContext;
  user?: UserContext;
  otherContext?: Record<string, string | number | undefined>;
}
