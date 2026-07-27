import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

const BASE = import.meta.env.BASE_URL ?? "/";

/**
 * Registro del service worker con auto-recarga: al bumpear CACHE en sw.js el
 * nuevo worker toma control y la pestaña se recarga UNA sola vez. Sin esto los
 * usuarios con la PWA instalada siguen viendo el bundle viejo por días.
 */
function registrarSW(): void {
  if (!("serviceWorker" in navigator)) return;

  // En la PRIMERA instalación `controller` es null y `clients.claim()` dispara
  // controllerchange igual. Recargar ahí sería una recarga gratuita para todo
  // visitante nuevo: sólo interesa recargar cuando REEMPLAZAMOS un worker viejo.
  const habiaControlador = navigator.serviceWorker.controller !== null;

  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaControlador || recargando) return;
    recargando = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${BASE}sw.js`)
      .then((reg) => {
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              nw.postMessage("SKIP_WAITING");
            }
          });
        });
        reg.update().catch(() => {});
      })
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

registrarSW();
