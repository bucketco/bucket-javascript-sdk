import { FunctionComponent, h } from "preact";

export const CheckCircle: FunctionComponent<
  h.JSX.SVGAttributes<SVGSVGElement>
> = (props) => (
  <svg
    height="24px"
    viewBox="0 0 24 24"
    width="24px"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 24C5.3724 24 0 18.6276 0 12C0 5.3724 5.3724 0 12 0C18.6276 0 24 5.3724 24 12C24 18.6276 18.6276 24 12 24ZM10.8036 16.8L19.2876 8.3148L17.5908 6.618L10.8036 13.4064L7.4088 10.0116L5.712 11.7084L10.8036 16.8Z"
      fill="currentColor"
    />
  </svg>
);
