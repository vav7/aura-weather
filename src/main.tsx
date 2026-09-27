import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// offline shell support - registered after load, failures are non-fatal
if ("serviceWorker" in navigator) {
  const prod = (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;
  if (prod) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* hosting without SW support - app still fully functional */
      });
    });
  }
}
