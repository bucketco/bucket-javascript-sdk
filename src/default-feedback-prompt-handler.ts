import bucketSDK from './index';
import { FeedbackPrompt } from './types';

export function defaultFeedbackPromptHandler(prompt: FeedbackPrompt) {
  bucketSDK.openFeedbackForm({
    featureId: prompt.featureId,
    userId: prompt.userId,
    title: prompt.question,
  });
}
