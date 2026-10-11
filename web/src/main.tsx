import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LearnerProvider } from "./lib/learner";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LearnerProvider>
        <App />
      </LearnerProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
