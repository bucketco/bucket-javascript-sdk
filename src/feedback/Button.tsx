import { FunctionComponent, h } from "preact";

import { Spinner } from "./Spinner";

export type ButtonProps = h.JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
  loadingText?: string;
};

export const Button: FunctionComponent<ButtonProps> = ({
  variant = "primary",
  isLoading,
  loadingText,
  children,
  ...rest
}) => {
  const classes = ["button", variant].join(" ");

  return (
    <button class={classes} {...rest}>
      {isLoading && <Spinner size="0.75em" />}
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
};
