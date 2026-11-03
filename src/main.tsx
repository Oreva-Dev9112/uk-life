import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { loadLondonForecast } from "./state/london";
import { useGame } from "./state/store";
import "./styles.css";

loadLondonForecast().then((ok) => { if (ok) useGame.getState().syncWeather(); });

createRoot(document.getElementById("root")!).render(<App />);
