import ReactDOM from "react-dom/client";

import { App } from "./app";
import React from "react";

const el = document.getElementById("app");

if (el) {
  const root = ReactDOM.createRoot(el);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
