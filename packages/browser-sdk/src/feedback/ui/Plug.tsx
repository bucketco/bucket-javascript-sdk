import { FunctionComponent, h } from "preact";

import { Logo } from "./icons/Logo";

export const Plug: FunctionComponent = () => {
  return (
    <footer className="plug">
      <a href="https://bucket.co" rel="noreferrer" target="_blank">
        Powered by <Logo /> Bucket
      </a>
    </footer>
  );
};
