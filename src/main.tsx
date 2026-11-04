import "@fontsource-variable/sora";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";

// Precache the app so it opens and bills with no internet. New versions
// install in the background and apply on the next load.
if ("serviceWorker" in navigator) registerSW({ immediate: true });

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
