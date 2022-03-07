export type Key = string;

export type Options = {
  host?: string;
};

export type User = {
  userId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
};

export type Company = {
  userId: string;
  companyId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
};

export type TrackedEvent = {
  event: string;
  userId: string;
  attributes?: {
    [key: string]: any;
  };
};
