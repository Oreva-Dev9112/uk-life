import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { loadLondonForecast } from "./state/london";
import { useGame } from "./state/store";

// Fonts are bundled with the game, so nothing is fetched from Google.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";

import "./styles.css";

loadLondonForecast().then((ok) => { if (ok) useGame.getState().syncWeather(); });

createRoot(document.getElementById("root")!).render(<App />);
