import { h, FunctionComponent } from "preact";

export type ButtonProps = h.JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export const Button: FunctionComponent<ButtonProps> = ({
  variant = "primary",
  children,
  ...rest
}) => {
  const classes = ["button", variant].join(" ");

  return (
    <button class={classes} {...rest}>
      {children}
    </button>
  );
};
