export interface CompanyContext {
  id: string | number;
  [key: string]: string | number;
}

export interface UserContext {
  id: string | number;
  [key: string]: string | number;
}

export interface BucketContext {
  company?: CompanyContext;
  user?: UserContext;
  otherContext?: Record<string, string | number>;
}
