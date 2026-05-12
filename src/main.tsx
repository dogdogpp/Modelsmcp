import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { Toaster } from "sonner";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#0c111a",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
        },
      }}
    />
  </>
);
