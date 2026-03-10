import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { measureWebVitals } from "./lib/vitals";

createRoot(document.getElementById("root")!).render(<App />);

measureWebVitals();
