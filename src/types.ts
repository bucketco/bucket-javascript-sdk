export type Key = string;

export type Options = {
  persistUser?: boolean;
  automaticFeedbackPrompting?: boolean;
  feedbackPromptCallback?: FeedbackPromptCallback;
  host?: string;
  debug?: boolean;
};

export type User = {
  userId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type Company = {
  userId: string;
  companyId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type TrackedEvent = {
  event: string;
  userId: string;
  companyId?: string;
  attributes?: {
    [key: string]: any;
  };
  context?: Context;
};

export type Feedback = {
  featureId: string;
  userId: string;
  companyId?: string;
  score?: number;
  comment?: string;
};

export type FeedbackPrompt = {
  question: string;
  showAfter: Date,
  showBefore: Date,
}

export type FeedbackPromptCallback = (req: FeedbackPrompt) => void

export type Context = {
  active?: boolean;
};
