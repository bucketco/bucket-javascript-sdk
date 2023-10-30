import { FunctionComponent, h } from "preact";

export const Check: FunctionComponent<h.JSX.SVGAttributes<SVGSVGElement>> = (
  props,
) => (
  <svg
    height="24px"
    width="24px"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fill="currentColor"
      d="m10 15.17l9.193-9.191l1.414 1.414l-10.606 10.606l-6.364-6.364l1.414-1.414l4.95 4.95Z"
    />
  </svg>
);
