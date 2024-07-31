import { FunctionComponent, h } from "preact";

import { Logo } from "./icons/Logo";

export const Plug: FunctionComponent = () => {
  return (
    <footer class="plug">
      <a href="https://bucket.co" target="_blank">
        Powered by <Logo /> Bucket
      </a>
    </footer>
  );
};
