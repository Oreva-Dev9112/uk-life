// Shared input state, written by keyboard listeners, the touch joystick and the camera's tap-to-move.
export const input = {
  keys: new Set<string>(),
  joy: { x: 0, y: 0 },
  clickTarget: null as null | { x: number; z: number },
};

export function moveAxes() {
  const k = input.keys;
  let f = 0, r = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) f += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) f -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) r += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) r -= 1;
  f += input.joy.y;
  r += input.joy.x;
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const run = k.has("ShiftLeft") || k.has("ShiftRight") || Math.hypot(input.joy.x, input.joy.y) > 0.92;
  return { f, r, run, active: len > 0.08 };
}
