import { useEffect, useRef, useState } from "react";
import { Game } from "../game/Game";
import { useGame } from "../state/store";
import { TitleScreen } from "./TitleScreen";
import { TopBar, Goals, Needs, InteractPrompt, Toasts, Fade, PhoneButton, GameOver } from "./HUD";
import { PlacePanel, JobsPanel, DialogPanel, TubePanel } from "./Panels";
import { Phone } from "./Phone";
import { Joystick } from "./Joystick";

const isTouch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

function GameCanvas({ onReady }: { onReady: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let g: Game | null = null;
    let cancelled = false;
    // Let the web fonts load first so shop signs (drawn on canvas) use them.
    const fonts = Promise.race([
      Promise.all([
        document.fonts.load("800 64px 'Space Grotesk'"),
        document.fonts.load("600 32px 'Inter'"),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    fonts.finally(() => {
      if (cancelled || !ref.current) return;
      g = new Game(ref.current);
      onReady();
    });
    return () => { cancelled = true; g?.dispose(); };
  }, [onReady]);
  return <div ref={ref} className="absolute inset-0" />;
}

export function App() {
  const phase = useGame((s) => s.phase);
  const panel = useGame((s) => s.panel);
  const [ready, setReady] = useState(false);
  const [onReady] = useState(() => () => setReady(true));

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <GameCanvas onReady={onReady} />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-ink">
          <div className="text-center">
            <div className="font-display text-4xl font-bold">UK <span className="text-brand">LIFE</span></div>
            <div className="mt-2 text-sm text-white/50 animate-pulse-soft">Building London… mind the gap</div>
          </div>
        </div>
      )}
      {ready && phase === "title" && <TitleScreen />}
      {ready && phase === "playing" && (
        <div className="pointer-events-none absolute inset-0">
          <TopBar />
          <Goals />
          <Needs touch={isTouch} />
          {isTouch && !panel && <Joystick />}
          <InteractPrompt touch={isTouch} />
          {panel?.kind === "place" && <PlacePanel id={panel.id} />}
          {panel?.kind === "jobs" && <JobsPanel />}
          {panel?.kind === "npc" && <DialogPanel id={panel.id} />}
          {panel?.kind === "tube" && <TubePanel />}
          <PhoneButton />
          <Phone />
          <Toasts />
          <Fade />
        </div>
      )}
      {phase === "gameover" && <GameOver />}
    </div>
  );
}
