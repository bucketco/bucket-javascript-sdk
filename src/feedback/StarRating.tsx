import { Fragment, FunctionComponent, h } from "preact";

import { Dissatisfied } from "./icons/Dissatisfied";
import { Neutral } from "./icons/Neutral";
import { Satisfied } from "./icons/Satisfied";
import { VeryDissatisfied } from "./icons/VeryDissatisfied";
import { VerySatisfied } from "./icons/VerySatisfied";
import { FeedbackTranslations } from "./types";

const scores = [
  {
    color: "var(--bucket-feedback-dialog-rating-1-color, #dd6b20)",
    bg: "var(--bucket-feedback-dialog-rating-1-background-color, #fbd38d)",
    icon: <VeryDissatisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreVeryDissatisfiedLabel,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-2-color, #ed8936)",
    bg: "var(--bucket-feedback-dialog-rating-2-background-color, #feebc8)",
    icon: <Dissatisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreDissatisfiedLabel,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-3-color, #787c91)",
    bg: "var(--bucket-feedback-dialog-rating-3-background-color, #e9e9ed)",
    icon: <Neutral />,
    getLabel: (t: FeedbackTranslations) => t.ScoreNeutralLabel,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-4-color, #48bb78)",
    bg: "var(--bucket-feedback-dialog-rating-4-background-color, #c6f6d5)",
    icon: <Satisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreSatisfiedLabel,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-5-color, #38a169)",
    bg: "var(--bucket-feedback-dialog-rating-5-background-color, #9ae6b4)",
    icon: <VerySatisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreVerySatisfiedLabel,
  },
];

export type StarRatingProps = {
  name: string;
  value?: number;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
  t: FeedbackTranslations;
};

export const StarRating: FunctionComponent<StarRatingProps> = ({
  t,
  name,
  value,
  onChange,
}) => {
  return (
    <div class="star-rating">
      <style>
        {scores.map(
          ({ bg }, index) =>
            `.star-rating > .button:nth-of-type(${index + 1}):hover {
              background-color: ${bg}
            }
            .star-rating > input:nth-of-type(${index + 1}):checked + .button {
              background-color: ${bg};
            }`,
        )}
      </style>
      <div class="star-rating-icons">
        {scores.map(({ color, icon, getLabel }, index) => (
          <>
            <input
              id={`bucket-feedback-score-${index + 1}`}
              type="radio"
              name={name}
              value={index + 1}
              defaultChecked={value === index + 1}
              onChange={onChange}
            />
            <label
              for={`bucket-feedback-score-${index + 1}`}
              class="button"
              style={{ color }}
              aria-label={getLabel(t)}
            >
              {icon}
            </label>
          </>
        ))}
      </div>
      <div class="star-rating-labels">
        <span>{t.ScoreVeryDissatisfiedLabel}</span>
        <span>{t.ScoreVerySatisfiedLabel}</span>
      </div>
    </div>
  );
};
