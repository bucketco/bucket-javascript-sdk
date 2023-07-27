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
  onSubmit: (data: Feedback) => void;
};

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = ({
  question,
  onSubmit,
}) => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit: h.JSX.GenericEventHandler<HTMLFormElement> = (e) => {
    const data = getFeedbackDataFromForm(e.target as HTMLFormElement);
    if (!data.score) return;
    onSubmit(data);
    setSubmitted(true);
  };

  if (submitted) {
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
        <StarRating name="score" />
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

      <Button type="submit">Send</Button>
    </form>
  );
};
