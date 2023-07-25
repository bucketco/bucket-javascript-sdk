import { h, FunctionComponent } from "preact";
import { VeryDissatisfied } from "../icons/VeryDissatisfied";
import { Dissatisfied } from "../icons/Dissatisfied";
import { Neutral } from "../icons/Neutral";
import { Satisfied } from "../icons/Satisfied";
import { VerySatisfied } from "../icons/VerySatisfied";

const scores = [
  { color: "#dd6b20", icon: <VeryDissatisfied />, label: "Very dissatisfied" },
  { color: "#ed8936", icon: <Dissatisfied />, label: "Dissatisfied" },
  { color: "#787c91", icon: <Neutral />, label: "Neutral" },
  { color: "#48bb78", icon: <Satisfied />, label: "Satisfied" },
  { color: "#38a169", icon: <VerySatisfied />, label: "Very satisfied" },
];

export const StarRating: FunctionComponent<{ name: string }> = ({ name }) => {
  return (
    <div class="star-rating">
      {scores.map(({ color, icon, label }, index) => (
        <>
          <input
            id={`bucket-feedback-score-${index + 1}`}
            type="radio"
            name={name}
            value={index + 1}
          />
          <label
            for={`bucket-feedback-score-${index + 1}`}
            class="button"
            style={{ color }}
          >
            {icon}
          </label>
        </>
      ))}
    </div>
  );
};
