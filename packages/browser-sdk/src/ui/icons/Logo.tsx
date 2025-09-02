import { FunctionComponent, h } from "preact";

export const Logo: FunctionComponent<h.JSX.SVGAttributes<SVGSVGElement>> = (
  props = { height: "10px", width: "10px" },
) => (
  <svg
    width="256"
    height="256"
    viewBox="0 0 256 256"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M181.333 64C187.224 64 192 68.7756 192 74.6667V181.333C192 187.224 187.224 192 181.333 192H74.6667C68.7756 192 64 187.224 64 181.333V74.6667C64 68.7756 68.7756 64 74.6667 64H181.333ZM74.6667 74.6667V181.333L181.333 74.6667H74.6667Z"
      fill="currentColor"
    />
  </svg>
);
