export type Key = string;

export type Options = {
  persistUser?: boolean;
  automaticFeedbackPrompting?: boolean;
  feedbackPromptHandler?: FeedbackPromptHandler;
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
  userId: User["userId"];
  companyId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type TrackedEvent = {
  event: string;
  userId: User["userId"];
  companyId?: Company["companyId"];
  attributes?: {
    [key: string]: any;
  };
  context?: Context;
};

export type Feedback = {
  featureId: string;
  userId: User["userId"];
  companyId?: Company["companyId"];
  score?: number;
  comment?: string;
  promptId?: FeedbackPrompt["promptId"];
};

export type FeedbackPrompt = {
  question: string;
  showAfter: Date;
  showBefore: Date;
  promptId: string;
  featureId: Feedback["featureId"];
};

export type FeedbackPromptReply = {
  companyId?: Company["companyId"];
  score?: Feedback["score"];
  comment?: Feedback["comment"];
};

export type FeedbackPromptReplyHandler = (
  reply: FeedbackPromptReply | null
) => void;

export type FeedbackPromptHandler = (
  req: FeedbackPrompt,
  replyCallback: FeedbackPromptReplyHandler
) => void;

export type Context = {
  active?: boolean;
};
