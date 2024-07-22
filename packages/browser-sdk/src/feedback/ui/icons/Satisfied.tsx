import { FunctionComponent, h } from "preact";

export const Satisfied: FunctionComponent<
  h.JSX.SVGAttributes<SVGSVGElement>
> = (props) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22ZM12 20C14.1217 20 16.1566 19.1571 17.6569 17.6569C19.1571 16.1566 20 14.1217 20 12C20 9.87827 19.1571 7.84344 17.6569 6.34315C16.1566 4.84285 14.1217 4 12 4C9.87827 4 7.84344 4.84285 6.34315 6.34315C4.84285 7.84344 4 9.87827 4 12C4 14.1217 4.84285 16.1566 6.34315 17.6569C7.84344 19.1571 9.87827 20 12 20ZM8 11C7.60217 11 7.22064 10.842 6.93934 10.5607C6.65803 10.2794 6.5 9.89782 6.5 9.5C6.5 9.10217 6.65803 8.72064 6.93934 8.43934C7.22064 8.15803 7.60217 8 8 8C8.39782 8 8.77935 8.15803 9.06066 8.43934C9.34196 8.72064 9.5 9.10217 9.5 9.5C9.5 9.89782 9.34196 10.2794 9.06066 10.5607C8.77935 10.842 8.39782 11 8 11ZM16 11C15.6022 11 15.2206 10.842 14.9393 10.5607C14.658 10.2794 14.5 9.89782 14.5 9.5C14.5 9.10217 14.658 8.72064 14.9393 8.43934C15.2206 8.15803 15.6022 8 16 8C16.3978 8 16.7794 8.15803 17.0607 8.43934C17.342 8.72064 17.5 9.10217 17.5 9.5C17.5 9.89782 17.342 10.2794 17.0607 10.5607C16.7794 10.842 16.3978 11 16 11Z"
      fill="currentColor"
    ></path>
    <path
      d="M7.79862 15.4322C8.85269 16.5065 10.4964 17.4971 11.9993 17.4971C13.5011 17.4971 15.1701 16.5079 16.2097 15.4351C16.5083 15.1269 16.4581 14.6416 16.1408 14.3528C15.9042 14.1375 15.5656 14.0777 15.2972 14.2517C14.5161 14.7578 13.4271 15.7002 11.9993 15.7002C10.5688 15.7002 9.47831 14.7549 8.69694 14.2486C8.43116 14.0764 8.09564 14.1353 7.86141 14.3485C7.5435 14.6378 7.49757 15.1254 7.79862 15.4322Z"
      fill="currentColor"
    ></path>
  </svg>
);
