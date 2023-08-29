import { Fragment, FunctionComponent, h } from "preact";

import { Dissatisfied } from "./icons/Dissatisfied";
import { Neutral } from "./icons/Neutral";
import { Satisfied } from "./icons/Satisfied";
import { VeryDissatisfied } from "./icons/VeryDissatisfied";
import { VerySatisfied } from "./icons/VerySatisfied";

const scores = [
  {
    color: "var(--bucket-feedback-dialog-very-dissatisfied-color, #dd6b20)",
    bg: "var(--bucket-feedback-dialog-very-dissatisfied-bg, #fbd38d)",
    icon: <VeryDissatisfied />,
    label: "Very dissatisfied",
  },
  {
    color: "var(--bucket-feedback-dialog-dissatisfied-color, #ed8936)",
    bg: "var(--bucket-feedback-dialog-dissatisfied-bg, #feebc8)",
    icon: <Dissatisfied />,
    label: "Dissatisfied",
  },
  {
    color: "var(--bucket-feedback-dialog-neutral-color, #787c91)",
    bg: "var(--bucket-feedback-dialog-neutral-bg, #e9e9ed)",
    icon: <Neutral />,
    label: "Neutral",
  },
  {
    color: "var(--bucket-feedback-dialog-satisfied-color, #48bb78)",
    bg: "var(--bucket-feedback-dialog-satisfied-bg, #c6f6d5)",
    icon: <Satisfied />,
    label: "Satisfied",
  },
  {
    color: "var(--bucket-feedback-dialog-very-satisfied-color, #38a169)",
    bg: "var(--bucket-feedback-dialog-very-satisfied-bg, #9ae6b4)",
    icon: <VerySatisfied />,
    label: "Very satisfied",
  },
];

export type StarRatingProps = {
  name: string;
  value?: number;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
};

export const StarRating: FunctionComponent<StarRatingProps> = ({
  name,
  value,
  onChange,
}) => {
  return (
    <>
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
      <div class="star-rating">
        {scores.map(({ color, icon, label }, index) => (
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
              aria-label={label}
            >
              {icon}
            </label>
          </>
        ))}
      </div>
      <div class="star-rating-labels">
        <span>{scores[0].label}</span>
        <span>{scores[scores.length - 1].label}</span>
      </div>
    </>
  );
};
