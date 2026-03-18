import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register Service Worker after the page is interactive
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    const swUrl = `${base}sw.js`.replace(/\/\//g, "/");

    navigator.serviceWorker
      .register(swUrl, { scope: base })
      .then((reg) => {
        // When a new SW is waiting, reload once it activates so users always get fresh code
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              // New version activated — reload silently to pick up updated assets
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {
        // SW unavailable (e.g. private browsing, HTTP) — app still works normally
      });

    // If the controller changes mid-session (SW update), reload to get fresh assets
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  });
}

// Suppress unhandled rejections from third-party ad libraries (Adcash, etc.)
window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || String(e?.reason || '');
  if (msg.includes('_0x') || msg.includes('aclib') || msg.includes('acscdn')) {
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
