import { FunctionComponent, h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Check } from "./icons/Check";
import { CheckCircle } from "./icons/CheckCircle";
import { Button } from "./Button";
import { Plug } from "./Plug";
import { StarRating } from "./StarRating";
import { FeedbackSubmission, FeedbackTranslations } from "./types";

const ANIMATION_SPEED = 400;

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
  openWithCommentVisible: boolean;
  onInteraction: () => void;
  onSubmit: (data: FeedbackSubmission) => Promise<void> | void;
  onScoreSubmit: (score: number) => Promise<void> | void;
};

export const FeedbackForm: FunctionComponent<FeedbackFormProps> = ({
  question,
  scoreState,
  openWithCommentVisible,
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

  const [showScoreStateLoading, setShowScoreStateLoading] = useState(false);
  useEffect(() => {
    if (scoreState === "idle" || scoreState === "submitted") {
      setShowScoreStateLoading(false);
      return;
    }

    const t = setTimeout(() => {
      setShowScoreStateLoading(true);
    }, 400);

    return () => clearTimeout(t);
  }, [scoreState]);

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

    // TODO: clean this up
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
      const isExpanded = openWithCommentVisible || hasRating;

      containerRef.current.style.maxHeight = isExpanded
        ? headerRef.current.clientHeight + // Header height
          expandedContentRef.current.clientHeight + // Comment + Button Height
          10 + // Gap height
          "px"
        : headerRef.current.clientHeight + "px";

      expandedContentRef.current.style.position = isExpanded
        ? "relative"
        : "absolute";

      expandedContentRef.current.style.opacity = isExpanded ? "1" : "0";
      expandedContentRef.current.style.pointerEvents = isExpanded
        ? "all"
        : "none";
    }
  }, [
    formRef,
    headerRef,
    expandedContentRef,
    openWithCommentVisible,
    hasRating,
    status,
  ]);

  return (
    <div ref={containerRef} class="container">
      <div ref={submittedRef} class="submitted">
        <div className="submitted-check">
          <CheckCircle width={24} height={24} />
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
              onChange={async (e) => {
                setHasRating(true);
                await onScoreSubmit(Number(e.currentTarget.value));
              }}
            />

            <div className="score-status-container">
              <span
                className="score-status"
                style={{
                  opacity:
                    scoreState === "idle" ||
                    (scoreState === "submitting" && !showScoreStateLoading)
                      ? 1
                      : 0,
                }}
              >
                {t.ScoreStatusDescription}
              </span>

              <div
                className="score-status"
                style={{
                  opacity:
                    scoreState !== "submitted" && showScoreStateLoading ? 1 : 0,
                }}
              >
                Submitting...
              </div>

              <span
                className="score-status"
                style={{ opacity: scoreState === "submitted" ? 1 : 0 }}
              >
                <Check width={14} height={14} style={{ marginRight: 3 }} />{" "}
                {t.ScoreStatusReceived}
              </span>
            </div>
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

            <Button
              type="submit"
              disabled={
                !hasRating ||
                status === "submitting" ||
                scoreState === "submitting"
              }
            >
              {t.SendButton}
            </Button>

            <Plug />
          </div>
        </form>
      )}
    </div>
  );
};
