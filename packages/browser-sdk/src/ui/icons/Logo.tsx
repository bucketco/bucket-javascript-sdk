import { FunctionComponent, h } from "preact";

export const Logo: FunctionComponent<h.JSX.SVGAttributes<SVGSVGElement>> = (
  props = { height: "10px", width: "10px" },
) => (
  <svg
    viewBox="0 0 300 316"
    width="10px"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12.4167 0.5C13.015 0.5 13.5 0.985025 13.5 1.58333V12.4167C13.5 13.015 13.015 13.5 12.4167 13.5H1.58333C0.985025 13.5 0.5 13.015 0.5 12.4167V1.58333C0.5 0.985025 0.985025 0.5 1.58333 0.5H12.4167ZM1.58333 1.58333V12.4167L12.4167 1.58333H1.58333Z"
      fill="white"
    />
  </svg>
);
