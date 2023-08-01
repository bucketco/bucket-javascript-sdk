import { h, FunctionComponent } from "preact";

export type SpinnerProps = Omit<h.JSX.HTMLAttributes<HTMLElement>, "size"> & {
  size?: string | number;
};

export const Spinner: FunctionComponent<SpinnerProps> = ({
  size = 16,
  ...rest
}) => {
  return (
    <div
      class="spinner"
      style={{
        width: typeof size == "number" ? `${size}px` : size,
        height: typeof size == "number" ? `${size}px` : size,
      }}
      {...rest}
    >
      <span class="hidden">Loading...</span>
    </div>
  );
};
