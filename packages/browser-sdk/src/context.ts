interface CompanyContext {
  id: string | number;
  [key: string]: string | number;
}

interface UserContext {
  id: string | number;
  [key: string]: string | number;
}

interface BucketContext {
  company?: CompanyContext;
  user?: UserContext;
  otherContext?: Record<string, string | number>;
}
