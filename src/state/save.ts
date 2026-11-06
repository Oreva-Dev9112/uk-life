// Saves your life in this browser (localStorage), so a refresh or a closed tab doesn't lose it. Nothing leaves the device.
import type { State } from "./store";

const KEY = "uklife.save";
const VERSION = 1;

// The parts of the state that make up a life. Everything else (panels, toasts, the phone) starts fresh.
const SAVED = [
  "profile", "money", "needs", "minutes", "weather", "weatherUntil", "job", "lastShiftDay", "rentWeeksPaid", "rentStrikes",
  "rel", "met", "topicAt", "visitedFlat", "area", "visited", "shiftsWorked", "hasSuit", "mumPaidWeek", "messages", "txs",
] as const;

export type SavedLife = Pick<State, (typeof SAVED)[number]>;

export function writeSave(s: State) {
  const life = Object.fromEntries(SAVED.map((k) => [k, s[k]]));
  try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, savedAt: Date.now(), life })); } catch { /* storage full or blocked */ }
}

/** The saved life, or null if there isn't one (or it can't be read). */
export function readSave(): { savedAt: number; life: Partial<SavedLife> } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (save?.v !== VERSION || typeof save.life?.minutes !== "number" || !save.life.profile) return null;
    return save;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
