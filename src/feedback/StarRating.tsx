import { Fragment, FunctionComponent, h } from "preact";

import { Dissatisfied } from "./icons/Dissatisfied";
import { Neutral } from "./icons/Neutral";
import { Satisfied } from "./icons/Satisfied";
import { VeryDissatisfied } from "./icons/VeryDissatisfied";
import { VerySatisfied } from "./icons/VerySatisfied";
import { FeedbackTranslations } from "./types";

const scores = [
  {
    color: "var(--bucket-feedback-dialog-rating-5-color, #38a169)",
    bg: "var(--bucket-feedback-dialog-rating-5-background-color, #9ae6b4)",
    icon: <VerySatisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreVerySatisfiedLabel,
    value: 5,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-4-color, #48bb78)",
    bg: "var(--bucket-feedback-dialog-rating-4-background-color, #c6f6d5)",
    icon: <Satisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreSatisfiedLabel,
    value: 4,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-3-color, #787c91)",
    bg: "var(--bucket-feedback-dialog-rating-3-background-color, #e9e9ed)",
    icon: <Neutral />,
    getLabel: (t: FeedbackTranslations) => t.ScoreNeutralLabel,
    value: 3,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-2-color, #ed8936)",
    bg: "var(--bucket-feedback-dialog-rating-2-background-color, #feebc8)",
    icon: <Dissatisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreDissatisfiedLabel,
    value: 2,
  },
  {
    color: "var(--bucket-feedback-dialog-rating-1-color, #dd6b20)",
    bg: "var(--bucket-feedback-dialog-rating-1-background-color, #fbd38d)",
    icon: <VeryDissatisfied />,
    getLabel: (t: FeedbackTranslations) => t.ScoreVeryDissatisfiedLabel,
    value: 1,
  },
];

export type StarRatingProps = {
  name: string;
  selectedValue?: number;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
  t: FeedbackTranslations;
};

export const StarRating: FunctionComponent<StarRatingProps> = ({
  t,
  name,
  selectedValue,
  onChange,
}) => {
  return (
    <div class="star-rating">
      <style>
        {scores.map(
          ({ bg, color }, index) => `
            .star-rating-icons > input:nth-of-type(${
              index + 1
            }):checked + .button {
              border-color: ${color};
            }

            /* TODO: use -bg var? */
            .star-rating-icons > input:nth-of-type(${
              index + 1
            }):checked + .button > div {
              background-color: ${bg};
            }

            /* TODO: fix corner cut outs */
            .star-rating-icons > input:nth-of-type(${
              index + 1
            }):checked ~ input:nth-of-type(${index + 2}) + .button {
              border-left-color: ${color};
            }
          `,
        )}
      </style>
      <div class="star-rating-icons">
        {scores.map(({ color, icon, getLabel, value }) => (
          <>
            <input
              id={`bucket-feedback-score-${value}`}
              type="radio"
              name={name}
              value={value}
              defaultChecked={value === selectedValue}
              onChange={onChange}
            />
            {/* TODO: center vertically perfectly */}
            <label
              for={`bucket-feedback-score-${value}`}
              class="button"
              style={{ color }}
              aria-label={getLabel(t)}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0.2,
                  zIndex: 1,
                }}
              />
              {/* TODO: fix zindexes */}
              <span
                style={{ zIndex: 2, display: "flex", alignItems: "center" }}
              >
                {icon}
              </span>
            </label>
          </>
        ))}
      </div>
    </div>
  );
};
