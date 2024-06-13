import { FlagData } from "@bucketco/flag-evaluation";

export type Context = {
  active?: boolean;
};

export type Feedback = {
  /**
   * Bucket feedback ID
   */
  feedbackId?: string;

  /**
   * Bucket feature ID
   */
  featureId: string;

  /**
   * User ID from your own application.
   */
  userId: string;

  /**
   * Company ID from your own application.
   */
  companyId: string;

  /**
   * The question that was presented to the user.
   */
  question?: string;

  /**
   * Customer satisfaction score.
   */
  score?: number;

  /**
   * User supplied comment about your feature.
   */
  comment?: string;
};

export type TrackedEvent = {
  event: string;
  userId: string;
  companyId?: string;
  attributes?: Record<string, any>;
  context?: Context;
};

export type FlagConfiguration = {
  key: string;
  flag: FlagData;
};

export type FlagContext = Record<string, unknown>;
