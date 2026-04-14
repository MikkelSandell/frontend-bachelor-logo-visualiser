/**
 * V11 / NF1 – Web Component entry point.
 *
 * Registers <logo-viewer> as a custom element backed by a React tree
 * mounted inside a shadow DOM root, so its styles are fully isolated
 * from the host page.
 *
 * Usage:
 *   <script src="logo-viewer.iife.js"></script>
 *   <logo-viewer product-id="abc-123" logo="https://…/logo.png"></logo-viewer>
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

class LogoViewerElement extends HTMLElement {
  private root?: ReturnType<typeof ReactDOM.createRoot>;

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadow.appendChild(container);

    const productId = this.getAttribute("product-id") ?? undefined;
    const logo = this.getAttribute("logo") ?? undefined;

    this.root = ReactDOM.createRoot(container);
    this.root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(App, {
          preloadedProductId: productId,
          preloadedLogo: logo,
        })
      )
    );
  }

  disconnectedCallback() {
    this.root?.unmount();
  }
}

customElements.define("logo-viewer", LogoViewerElement);
