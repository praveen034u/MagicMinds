import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Auth0ProviderWrapper } from "./contexts/Auth0Context";

createRoot(document.getElementById("root")!).render(
  <Auth0ProviderWrapper>
    <App />
  </Auth0ProviderWrapper>
);
