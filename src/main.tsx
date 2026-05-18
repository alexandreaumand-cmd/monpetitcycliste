import { init } from 'https://esm.sh/@bworlds/launchkit@1';
init({ buildSlug: 'labordure-b8aa' });
import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { measureWebVitals } from "./lib/vitals";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

measureWebVitals();
