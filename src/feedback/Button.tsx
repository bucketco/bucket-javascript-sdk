import { h, FunctionComponent, ComponentChildren } from "preact";
import styles from "./Button.styles.css?inline";

export type ButtonProps = h.JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  children?: ComponentChildren;
};

export const Button: FunctionComponent<ButtonProps> = ({
  variant = "primary",
  children,
  ...rest
}) => {
  const classes = ["button", variant].join(" ");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <button class={classes} {...rest}>
        {children}
      </button>
    </>
  );
};
