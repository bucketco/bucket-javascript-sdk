import { h, FunctionComponent } from "preact";
import { FeedbackDialogOptions } from "./types";
import { Feedback } from "./types";
import styles from "./feedback-form.css?inline";
import { StarRating } from "./StarRating";
import { Button } from "./Button";

function getFeedbackDataFromForm(el: HTMLFormElement): Feedback {
  const formData = new FormData(el);
  const feedback: Feedback = {
    rating: Number(formData.get("rating")?.toString()),
    comment: (formData.get("comment")?.toString() || "").trim(),
  };

  return feedback;
}

export const FeedbackForm: FunctionComponent<
  Required<Pick<FeedbackDialogOptions, "onSubmit">>
> = ({ onSubmit }) => {
  const handleSubmit: h.JSX.GenericEventHandler<HTMLFormElement> = (e) => {
    onSubmit(getFeedbackDataFromForm(e.target as HTMLFormElement));
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <form
        onSubmit={handleSubmit}
        method="dialog"
        class="bucket-component-feedback-form"
      >
        <fieldset>
          <legend>Rating</legend>

          <StarRating name="rating" />
        </fieldset>

        <label class="comment">
          Comment
          <textarea name="comment" placeholder="Write your comment here" />
        </label>

        <div class="buttons">
          <Button value="cancel" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Submit</Button>
        </div>
      </form>
    </>
  );
};
