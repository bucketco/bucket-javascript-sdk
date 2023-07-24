import { h, FunctionComponent } from "preact";
import styles from "./StarRating.css?inline";

export const StarRating: FunctionComponent<{ name: string }> = () => {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <div class="star-rating">
        <label>
          <span>1</span>
          <input type="radio" name="rating" value={1} />
        </label>

        <label>
          <span>2</span>
          <input type="radio" name="rating" value={2} />
        </label>

        <label>
          <span>3</span>
          <input type="radio" name="rating" value={3} />
        </label>

        <label>
          <span>4</span>
          <input type="radio" name="rating" value={4} />
        </label>

        <label>
          <span>5</span>
          <input type="radio" name="rating" value={5} />
        </label>
      </div>
    </>
  );
};
