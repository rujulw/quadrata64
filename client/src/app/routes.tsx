import { createBrowserRouter } from "react-router-dom";

import App from "../App";
import LandingPage from "../pages/LandingPage";
import PlayPage from "../pages/PlayPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "play",
        element: <PlayPage />,
      },
      {
        path: "rooms",
        element: <PlayPage />,
      },
      {
        path: "settings",
        element: <LandingPage />,
      },
    ],
  },
]);
