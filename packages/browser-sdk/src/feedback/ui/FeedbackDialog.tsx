import { Fragment, FunctionComponent, h } from "preact";
import { useCallback, useState } from "preact/hooks";

import { feedbackContainerId } from "../../ui/constants";
import { Dialog, useDialog } from "../../ui/Dialog";
import { Close } from "../../ui/icons/Close";

import { DEFAULT_TRANSLATIONS } from "./config/defaultTranslations";
import { useTimer } from "./hooks/useTimer";
import { FeedbackForm } from "./FeedbackForm";
import styles from "./index.css?inline";
import { RadialProgress } from "./RadialProgress";
import {
  FeedbackScoreSubmission,
  FeedbackSubmission,
  OpenFeedbackFormOptions,
  WithRequired,
} from "./types";

export type FeedbackDialogProps = WithRequired<
  OpenFeedbackFormOptions,
  "onSubmit" | "position"
>;

const INACTIVE_DURATION_MS = 20 * 1000;
const SUCCESS_DURATION_MS = 3 * 1000;

export const FeedbackDialog: FunctionComponent<FeedbackDialogProps> = ({
  key,
  title = DEFAULT_TRANSLATIONS.DefaultQuestionLabel,
  position,
  translations = DEFAULT_TRANSLATIONS,
  openWithCommentVisible = false,
  onClose,
  onDismiss,
  onSubmit,
  onScoreSubmit,
}) => {
  const [feedbackId, setFeedbackId] = useState<string | undefined>(undefined);
  const [scoreState, setScoreState] = useState<
    "idle" | "submitting" | "submitted"
  >("idle");

  const submit = useCallback(
    async (data: Omit<FeedbackSubmission, "feedbackId">) => {
      await onSubmit({ ...data, feedbackId });
      autoClose.startWithDuration(SUCCESS_DURATION_MS);
    },
    [feedbackId, onSubmit],
  );

  const submitScore = useCallback(
    async (data: Omit<FeedbackScoreSubmission, "feedbackId">) => {
      if (onScoreSubmit !== undefined) {
        setScoreState("submitting");

        const res = await onScoreSubmit({ ...data, feedbackId });
        setFeedbackId(res.feedbackId);
        setScoreState("submitted");
      }
    },
    [feedbackId, onSubmit],
  );

  const { isOpen, close } = useDialog({ onClose, initialValue: true });

  const autoClose = useTimer({
    enabled: position.type === "DIALOG",
    initialDuration: INACTIVE_DURATION_MS,
    onEnd: close,
  });

  const dismiss = useCallback(() => {
    autoClose.stop();
    close();
    onDismiss?.();
  }, [autoClose, close, onDismiss]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <Dialog
        isOpen={isOpen}
        containerId={feedbackContainerId}
        key={key}
        position={position}
        close={close}
        onDismiss={onDismiss}
      >
        <>
          <FeedbackForm
            t={{ ...DEFAULT_TRANSLATIONS, ...translations }}
            key={key}
            question={title}
            openWithCommentVisible={openWithCommentVisible}
            onSubmit={submit}
            onScoreSubmit={submitScore}
            scoreState={scoreState}
            onInteraction={autoClose.stop}
          />

          <button class="close" onClick={dismiss}>
            {!autoClose.stopped && autoClose.elapsedFraction > 0 && (
              <RadialProgress
                diameter={28}
                progress={1.0 - autoClose.elapsedFraction}
              />
            )}
            <Close />
          </button>
        </>
      </Dialog>
    </>
  );
};
