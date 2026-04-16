import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if (typeof window !== "undefined" && import.meta.env.DEV && "serviceWorker" in navigator) {
  // Prevent stale localhost SW caches from serving old broken bundles during dev.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
}

if (
  typeof window !== "undefined" &&
  import.meta.env.PROD &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore registration errors (offline tooling, blocked SW, etc.) */
    });
  });
}
