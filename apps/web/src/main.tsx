import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {RegistrationBoundary} from "./registration/RegistrationBoundary";
import "./styles.css";
import "./ui/luemi-v5.css";
import "./ui/liquid-glass.css";
import "./ui/vivid-routes.css";
import "./ui/vivid-discovery.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(<React.StrictMode><RegistrationBoundary><App /></RegistrationBoundary></React.StrictMode>);
