import { useRef, useState, type PointerEvent } from "react";
import { input } from "../game/systems/input";

// Virtual thumbstick for touch screens. Writes to the shared input state.
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const R = 52;

  const move = (e: PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    input.joy.x = dx / R;
    input.joy.y = -dy / R;
    setKnob({ x: dx, y: dy, active: true });
  };
  const end = () => {
    input.joy.x = 0;
    input.joy.y = 0;
    setKnob({ x: 0, y: 0, active: false });
  };

  return (
    <div
      ref={base}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => knob.active && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
      className="pointer-events-auto absolute bottom-6 left-6 h-36 w-36 touch-none rounded-full border border-white/15 bg-white/8 backdrop-blur-md"
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-white/30 bg-white/30 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
