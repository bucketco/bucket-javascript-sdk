import { h, FunctionComponent } from "preact";
import { Feedback } from "./types";
import { StarRating } from "./StarRating";
import { Button } from "./Button";
import { useState } from "preact/hooks";

function getFeedbackDataFromForm(el: HTMLFormElement): Feedback {
  const formData = new FormData(el);
  const feedback: Feedback = {
    score: Number(formData.get("score")?.toString()),
    comment: (formData.get("comment")?.toString() || "").trim(),
  };
  return feedback;
}

type FeedbackFormProps = {
  question: string;
  onSubmit: (data: Feedback) => Promise<any>;
};

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = ({
  question,
  onSubmit,
}) => {
  const [hasRating, setHasRating] = useState(false);
  const [status, setStatus] = useState<
    "default" | "submitting" | "error" | "submitted"
  >("default");
  const [error, setError] = useState<string>();

  const handleSubmit: h.JSX.GenericEventHandler<HTMLFormElement> = async (
    e
  ) => {
    e.preventDefault();
    const data = getFeedbackDataFromForm(e.target as HTMLFormElement);
    if (!data.score) return;
    try {
      setStatus("submitting");
      await onSubmit(data);
      setStatus("submitted");
    } catch (e) {
      setStatus("error");
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Couldn't submit feedback.");
      }
    }
  };

  if (status == "error") {
    return (
      <div class="error">
        <p class="icon">😞</p>
        <p class="text">{error}</p>
      </div>
    );
  }

  if (status == "submitted") {
    return (
      <div class="submitted">
        <p class="icon">🙏</p>
        <p class="text">Thank you for sending your feedback!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} method="dialog" class="form">
      <div
        role="group"
        class="form-control"
        aria-labelledby="bucket-feedback-score-label"
      >
        <div id="bucket-feedback-score-label" class="label">
          {question}
        </div>
        <StarRating name="score" onChange={() => setHasRating(true)} />
      </div>

      <div class="form-control">
        <label for="bucket-feedback-comment-label" class="label">
          Leave a comment <span class="dimmed">(optional)</span>
        </label>
        <textarea
          id="bucket-feedback-comment-label"
          class="textarea"
          name="comment"
          placeholder="How can we improve this feature?"
          rows={5}
        />
      </div>

      <Button type="submit" disabled={!hasRating}>
        Send
      </Button>
    </form>
  );
};
