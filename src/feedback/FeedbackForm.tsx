import { FunctionComponent, h } from "preact";
import { useState } from "preact/hooks";

import { Button } from "./Button";
import { StarRating } from "./StarRating";
import { FeedbackSubmission, FeedbackTranslations } from "./types";

function getFeedbackDataFromForm(el: HTMLFormElement): FeedbackSubmission {
  const formData = new FormData(el);
  const feedback: FeedbackSubmission = {
    score: Number(formData.get("score")?.toString()),
    comment: (formData.get("comment")?.toString() || "").trim(),
  };
  return feedback;
}

type FeedbackFormProps = {
  t: FeedbackTranslations;
  question: string;
  onInteraction: () => void;
  onSubmit: (data: FeedbackSubmission) => Promise<void> | void;
};

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = ({
  question,
  onInteraction,
  onSubmit,
  t,
}) => {
  const [hasRating, setHasRating] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle",
  );
  const [error, setError] = useState<string>();

  const handleSubmit: h.JSX.GenericEventHandler<HTMLFormElement> = async (
    e,
  ) => {
    e.preventDefault();
    const data = getFeedbackDataFromForm(e.target as HTMLFormElement);
    if (!data.score) return;
    setError("");
    try {
      setStatus("submitting");
      await onSubmit(data);
      setStatus("submitted");
    } catch (err) {
      setStatus("idle");
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === "string") {
        setError(err);
      } else {
        setError("Couldn't submit feedback. Please try again.");
      }
    }
  };

  if (status === "submitted") {
    return (
      <div class="submitted">
        <p class="icon">🙏</p>
        <p class="text">{t.SuccessMessage}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      method="dialog"
      class="form"
      onFocus={onInteraction}
      onFocusCapture={onInteraction}
      onClick={onInteraction}
    >
      <div
        role="group"
        class="form-control"
        aria-labelledby="bucket-feedback-score-label"
      >
        <div id="bucket-feedback-score-label" class="label">
          {question}
        </div>
        <StarRating t={t} name="score" onChange={() => setHasRating(true)} />
      </div>

      <div class="form-control">
        <label for="bucket-feedback-comment-label" class="label">
          {t.CommentLabel}
        </label>
        <textarea
          id="bucket-feedback-comment-label"
          class="textarea"
          name="comment"
          placeholder={t.QuestionPlaceholder}
          rows={5}
        />
      </div>

      {error && <p class="error">{error}</p>}

      <Button
        type="submit"
        disabled={!hasRating || status === "submitting"}
        loadingText="Submitting"
      >
        {t.SendButton}
      </Button>
    </form>
  );
};
