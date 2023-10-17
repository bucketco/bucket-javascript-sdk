import { FunctionComponent, h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Check } from "./icons/Check";
import { Button } from "./Button";
import { StarRating } from "./StarRating";
import { FeedbackSubmission, FeedbackTranslations } from "./types";
import { Plug } from "./Plug";

const ANIMATION_SPEED = 300;

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
  scoreState: "idle" | "submitting" | "submitted";
  onInteraction: () => void;
  onSubmit: (data: FeedbackSubmission) => Promise<void> | void;
  onScoreSubmit: (score: number) => Promise<void> | void;
};

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = ({
  question,
  scoreState,
  onInteraction,
  onSubmit,
  onScoreSubmit,
  t,
}) => {
  const [hasRating, setHasRating] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle",
  );
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(true);

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

  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const expandedContentRef = useRef<HTMLDivElement>(null);
  const submittedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current === null) return;
    if (formRef.current === null) return;
    if (headerRef.current === null) return;
    if (expandedContentRef.current === null) return;
    if (submittedRef.current === null) return;

    if (status === "submitted") {
      formRef.current.style.opacity = "0";
      formRef.current.style.pointerEvents = "none";
      containerRef.current.style.maxHeight =
        submittedRef.current.clientHeight + "px";

      // Fade in "submitted" step once container has resized
      setTimeout(() => {
        submittedRef.current!.style.position = "relative";
        submittedRef.current!.style.opacity = "1";
        submittedRef.current!.style.pointerEvents = "all";
        setShowForm(false);
      }, ANIMATION_SPEED + 10);
    } else {
      containerRef.current.style.maxHeight = hasRating
        ? "400px" // TODO: reconsider?
        : headerRef.current.clientHeight + "px";

      expandedContentRef.current.style.display = hasRating ? "block" : "none";
      expandedContentRef.current.style.opacity = hasRating ? "1" : "0";
      expandedContentRef.current.style.pointerEvents = hasRating
        ? "all"
        : "none";
    }
  }, [formRef, headerRef, expandedContentRef, hasRating, status]);

  return (
    <div ref={containerRef} class="container">
      <div ref={submittedRef} class="submitted">
        <div className="submitted-check">
          <Check width={16} height={16} />
        </div>
        <p className="text">{t.SuccessMessage}</p>
        <Plug />
      </div>
      {showForm && (
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
            <StarRating
              t={t}
              name="score"
              onChange={(e) => {
                setHasRating(true);
                onScoreSubmit(Number(e.currentTarget.value)); // TODO: check
              }}
            />
            {scoreState === "idle" ? (
              <span className="score-status">{t.ScoreStatusDescription}</span>
            ) : (
              <span className="score-status">
                <Check width={14} height={14} style={{ marginRight: 3 }} />{" "}
                {t.ScoreStatusReceived}
              </span>
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
              />
            </div>

            {error && <p class="error">{error}</p>}

            <Button type="submit" disabled={status === "submitting"}>
              {t.SendButton}
            </Button>

            <Plug />
          </div>
        </form>
      )}
    </div>
  );
};
