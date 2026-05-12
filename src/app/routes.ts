import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Models } from "./pages/Models";
import { ModelDetail } from "./pages/ModelDetail";
import { Playground } from "./pages/Playground";
import { Docs } from "./pages/Docs";
import { Status } from "./pages/Status";
import { CommunicationSettings } from "./pages/CommunicationSettings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "models", Component: Models },
      { path: "models/:modelId", Component: ModelDetail },
      { path: "playground", Component: Playground },
      { path: "docs", Component: Docs },
      { path: "status", Component: Status },
      { path: "settings/communication", Component: CommunicationSettings },
    ],
  },
]);
