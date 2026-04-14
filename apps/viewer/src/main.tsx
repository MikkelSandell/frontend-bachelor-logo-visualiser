import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

// V10 – pre-loaded logo via URL parameter (?logo=<url>&product=<id>)
const params = new URLSearchParams(window.location.search);
const preloadedLogo = params.get("logo") ?? undefined;
const preloadedProductId = params.get("product") ?? undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App preloadedLogo={preloadedLogo} preloadedProductId={preloadedProductId} />
  </React.StrictMode>
);
