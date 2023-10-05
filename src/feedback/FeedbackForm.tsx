import { FunctionComponent, h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Button } from "./Button";
import { StarRating } from "./StarRating";
import { FeedbackSubmission, FeedbackTranslations } from "./types";
import { Plug } from "./Plug";

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
  // const [hasComment, setHasComment] = useState(false);
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

  const formRef = useRef<HTMLFormElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const expandedContentRef = useRef<HTMLDivElement>(null);
  const submittedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formRef.current === null) return;
    if (headerRef.current === null) return;
    if (expandedContentRef.current === null) return;
    if (submittedRef.current === null) return;

    if (status === "submitted") {
      formRef.current.style.opacity = "0";
      formRef.current.style.pointerEvents = "none";
      formRef.current.style.maxHeight =
        submittedRef.current.clientHeight + "px";

      setTimeout(() => {
        submittedRef.current!.style.opacity = "1";
        submittedRef.current!.style.pointerEvents = "all";
      }, 310); // TODO: magic number, consider impact of new effect
    } else {
      formRef.current.style.maxHeight = hasRating
        ? "400px" // TODO: reconsider?
        : headerRef.current.clientHeight + "px";

      expandedContentRef.current.style.opacity = hasRating ? "1" : "0";
      expandedContentRef.current.style.pointerEvents = hasRating
        ? "all"
        : "none";
    }
  }, [formRef, headerRef, expandedContentRef, hasRating, status]);

  return (
    <div>
      <div ref={submittedRef} class="submitted">
        <p className="text">{t.SuccessMessage}</p>
        <Plug />
      </div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        method="dialog"
        class="form"
        onFocus={onInteraction}
        onFocusCapture={onInteraction}
        onClick={onInteraction}
        style={{ opacity: 1 }}
      >
        <div
          ref={headerRef}
          role="group"
          class="form-control"
          aria-labelledby="bucket-feedback-score-label"
        >
          <div id="bucket-feedback-score-label" class="title">
            {question}
          </div>
          <StarRating t={t} name="score" onChange={() => setHasRating(true)} />
          {/* TODO: translations */}
          {hasRating ? (
            // TODO: fix this lie
            <span>Rating has been received!</span>
          ) : (
            <span>Pick a score and leave a comment</span>
          )}
        </div>

        <div ref={expandedContentRef} class="form-expanded-content">
          <div class="form-control">
            <textarea
              id="bucket-feedback-comment-label"
              class="textarea"
              name="comment"
              placeholder={t.QuestionPlaceholder}
              rows={5}
              // TODO: dedup + use?
              // onBlur={(e) => setHasComment(e.currentTarget?.value.trim() !== "")}
              // onChange={(e) => setHasComment(e.currentTarget?.value.trim() !== "")}
              // onKeyUp={(e) => setHasComment(e.currentTarget?.value.trim() !== "")}
            />
          </div>

          {error && <p class="error">{error}</p>}

          <Button type="submit" disabled={status === "submitting"}>
            {t.SendButton}
          </Button>

          <Plug />
        </div>
      </form>
    </div>
  );
};
