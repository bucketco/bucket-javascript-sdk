import { FunctionComponent, h } from "preact";

export const Flag: FunctionComponent<h.JSX.SVGAttributes<SVGSVGElement>> = (
  props,
) => (
  <svg
    fill="none"
    height="24"
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M11.4004 14V12.166H2.74223C2.05851 12.1657 1.71734 11.3385 2.20219 10.8565L11.4268 1.6963L11.5205 1.61622C12.0095 1.26003 12.7334 1.60103 12.7334 2.24024V14C12.7334 14.3681 12.4345 14.666 12.0664 14.666C11.6985 14.6659 11.4004 14.368 11.4004 14ZM4.11625 10.834H11.4004V3.6006L4.11625 10.834Z"
      fill="currentColor"
    />
  </svg>
);
