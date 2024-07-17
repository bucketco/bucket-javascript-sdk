import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";

const el = document.getElementById("app");

if (el) {
  const root = ReactDOM.createRoot(el);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
