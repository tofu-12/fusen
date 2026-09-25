import React from "react";
import ReactDOM from "react-dom/client";
import MainWindow from "./MainWindow";
import "./index.css";

if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
  const { installMockBackend } = await import("./dev/mockBackend");
  installMockBackend();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MainWindow />
  </React.StrictMode>,
);
