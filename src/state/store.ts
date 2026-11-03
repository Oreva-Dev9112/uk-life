import { create } from "zustand";
import {
  AREAS, BACKGROUNDS, DAY_NAMES, JOBS, LINES, NEED_DECAY, NEED_KEYS, NIGHT_BUS_FARE, NPCS, TUBE_FARE, WEEKLY_RENT,
  isOpen, npcById, placeById, relationshipTier, travelMinutes, tubeRunning,
  type AreaId, type Background, type Gender, type HairStyle, type JobId, type NeedKey, type Needs, type Topic,
} from "./content";

// ---------- time helpers ----------
export const dayOf = (m: number) => Math.floor(m / 1440) + 1;
export const hourOf = (m: number) => (m % 1440) / 60;
export const weekdayOf = (m: number) => DAY_NAMES[(dayOf(m) - 1) % 7];
export const fmtHour = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
export const fmtTime = (m: number) => fmtHour(hourOf(m));
export const fmtMoney = (n: number) =>
  `${n < 0 ? "-" : ""}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// ---------- types ----------
export interface Look { skin: string; hair: string; jacket: string; trousers: string; hairStyle: HairStyle; gender: Gender }
export interface Profile { name: string; background: Background; look: Look }
export type Tone = "info" | "good" | "bad";
export interface Toast { id: number; text: string; tone: Tone }
export interface Message { id: number; from: string; text: string; at: number; read: boolean }
export interface Tx { id: number; label: string; amount: number; at: number }
export type WeatherKind = "rain" | "drizzle" | "overcast" | "clear";
export interface Nearby { kind: "place" | "npc"; id: string; label: string; sub?: string }
export type Panel = null | { kind: "place"; id: string } | { kind: "npc"; id: string } | { kind: "jobs" } | { kind: "tube" };
export interface DialogLine { who: "npc" | "you" | "narrator"; text: string }
export type PhoneApp = "home" | "messages" | "jobs" | "bank" | "map" | "contacts" | "settings";
export type Quality = "high" | "low";
type Mode = "awake" | "sleep" | "work";

export const FLAT_DOOR = { x: -42, z: 8.6 };
export const SPAWN = { x: -72, z: -7.6 };

const DECAY_MULT: Record<Mode, Needs> = {
  awake: { hunger: 1, energy: 1, hygiene: 1, fun: 1, social: 1 },
  sleep: { hunger: 0.45, energy: -3.9, hygiene: 0.5, fun: 0, social: 0.3 },
  work: { hunger: 1.3, energy: 1.6, hygiene: 1.4, fun: 1.5, social: 0 },
};

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  rain: "Chucking it down", drizzle: "Drizzle", overcast: "Overcast", clear: "Clear (rare)",
};

interface State {
  phase: "title" | "playing" | "gameover";
  gameOverReason: string;
  profile: Profile;
  money: number;
  needs: Needs;
  minutes: number;
  weather: WeatherKind;
  weatherUntil: number;
  job: JobId | null;
  lastShiftDay: number;
  rentWeeksPaid: number;
  rentStrikes: number;
  rel: Record<string, number>;
  met: Record<string, boolean>;
  topicAt: Record<string, number>;
  visitedFlat: boolean;
  area: AreaId;
  visited: Record<AreaId, boolean>;
  shiftsWorked: number;
  hasSuit: boolean;
  mumPaidWeek: number;
  messages: Message[];
  txs: Tx[];
  toasts: Toast[];
  nearby: Nearby | null;
  panel: Panel;
  dialog: DialogLine[];
  phoneOpen: boolean;
  phoneApp: PhoneApp;
  fade: { text: string; key: number } | null;
  teleport: { x: number; z: number; key: number } | null;
  settings: { quality: Quality; volume: number };
  draftLook: Look | null; // the character being designed on the title screen (drives the 3D preview)

  setDraftLook: (l: Look | null) => void;
  startGame: (p: Profile) => void;
  travel: (to: AreaId, fromStation: boolean) => void;
  restart: () => void;
  tick: (dm: number, mode?: Mode) => void;
  setNearby: (n: Nearby | null) => void;
  interact: () => void;
  openPanel: (p: Panel) => void;
  closePanel: () => void;
  doPlaceAction: (placeId: string, actionId: string) => void;
  talk: (npcId: string, topic: Topic) => void;
  applyJob: (id: JobId) => void;
  quitJob: () => void;
  deliveryRun: () => void;
  payRent: () => void;
  togglePhone: (open?: boolean) => void;
  setPhoneApp: (a: PhoneApp) => void;
  toast: (text: string, tone?: Tone) => void;
  message: (from: string, text: string) => void;
  readAll: () => void;
  setQuality: (q: Quality) => void;
  setVolume: (v: number) => void;
}

let uid = 1;

function loadSettings(): { quality: Quality; volume: number } {
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const fallback = { quality: (coarse ? "low" : "high") as Quality, volume: 0.7 };
  try {
    const raw = localStorage.getItem("uklife.settings");
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function saveSettings(s: { quality: Quality; volume: number }) {
  try { localStorage.setItem("uklife.settings", JSON.stringify(s)); } catch { /* storage unavailable */ }
}

const START_MINUTES = 18 * 60 + 30; // Day 1 (Monday), 18:30

const freshGame = () => ({
  gameOverReason: "",
  money: 0,
  needs: { hunger: 60, energy: 72, hygiene: 55, fun: 50, social: 35 } as Needs,
  minutes: START_MINUTES,
  weather: "rain" as WeatherKind,
  weatherUntil: START_MINUTES + 60, // (the arrival downpour lasts a game hour, so new players see it change early)
  job: null as JobId | null,
  lastShiftDay: 0,
  rentWeeksPaid: 0,
  rentStrikes: 0,
  rel: Object.fromEntries(NPCS.map((n) => [n.id, 0])) as Record<string, number>,
  met: {} as Record<string, boolean>,
  topicAt: {} as Record<string, number>,
  visitedFlat: false,
  area: "albion" as AreaId,
  visited: { albion: true, city: false, soho: false, camden: false } as Record<AreaId, boolean>,
  shiftsWorked: 0,
  hasSuit: false,
  mumPaidWeek: 0,
  messages: [] as Message[],
  txs: [] as Tx[],
  nearby: null as Nearby | null,
  panel: null as Panel,
  dialog: [] as DialogLine[],
  phoneOpen: false,
  phoneApp: "home" as PhoneApp,
  fade: null,
  teleport: null,
});

export const mood = (n: Needs) => NEED_KEYS.reduce((a, k) => a + n[k], 0) / NEED_KEYS.length;
export const currentWeek = (m: number) => Math.floor((dayOf(m) - 1) / 7) + 1;
export const rentOwedWeeks = (s: { minutes: number; rentWeeksPaid: number }) => Math.max(0, currentWeek(s.minutes) - s.rentWeeksPaid);

export const useGame = create<State>()((set, get) => {
  const toast = (text: string, tone: Tone = "info") => {
    const id = uid++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
  };

  const fade = (text: string) => {
    const key = uid++;
    set({ fade: { text, key } });
    setTimeout(() => { if (get().fade?.key === key) set({ fade: null }); }, 1500);
  };

  const spend = (amount: number, label: string) => {
    const s = get();
    if (s.money < amount) {
      toast(`Card declined. You need ${fmtMoney(amount)}.`, "bad");
      return false;
    }
    set({ money: +(s.money - amount).toFixed(2), txs: [{ id: uid++, label, amount: -amount, at: s.minutes }, ...s.txs].slice(0, 60) });
    return true;
  };

  const earn = (amount: number, label: string) => {
    const s = get();
    set({ money: +(s.money + amount).toFixed(2), txs: [{ id: uid++, label, amount, at: s.minutes }, ...s.txs].slice(0, 60) });
  };

  const addNeeds = (delta: Partial<Needs>) => {
    const n = { ...get().needs };
    for (const k of Object.keys(delta) as NeedKey[]) n[k] = clamp(n[k] + (delta[k] ?? 0));
    set({ needs: n });
  };

  const message = (from: string, text: string) => {
    set((s) => ({ messages: [{ id: uid++, from, text, at: s.minutes, read: false }, ...s.messages] }));
    toast(`New message from ${from}`);
  };

  const rollWeather = (now: number) => {
    const r = Math.random();
    const weather: WeatherKind = r < 0.25 ? "rain" : r < 0.5 ? "drizzle" : r < 0.8 ? "overcast" : "clear";
    set({ weather, weatherUntil: now + 120 + Math.random() * 240 });
    if (weather === "clear") toast("The sun's out! Everyone panic.", "good");
  };

  const onNewDay = (day: number) => {
    const s = get();
    const weekday = (day - 1) % 7; // 0 = Monday
    if (weekday === 0 && day > 1) {
      const weeksDone = (day - 1) / 7;
      if (s.rentWeeksPaid < weeksDone) {
        const strikes = s.rentStrikes + 1;
        set({ rentStrikes: strikes });
        if (strikes >= 2) {
          set({ phase: "gameover", gameOverReason: "Kev changed the locks. You're moving back to your mum's in Swindon." });
          return;
        }
        message("Kev (Landlord)", `You missed rent. You owe me ${fmtMoney(rentOwedWeeks(get()) * WEEKLY_RENT)} now. Sort it by Sunday or you're out. Not joking.`);
      }
    }
    if (weekday === 5 && rentOwedWeeks(get()) > 0) message("Kev (Landlord)", "Just a reminder, rent's due tomorrow night. Cheers.");
    if (weekday === 6 && rentOwedWeeks(get()) > 0) toast("Rent's due tonight! Pay from your phone's Bank app.", "bad");
  };

  const tick = (dm: number, mode: Mode = "awake") => {
    const s = get();
    if (s.phase !== "playing" || dm <= 0) return;
    const before = s.minutes;
    const after = before + dm;
    const n = { ...s.needs };
    const start = { ...s.needs };
    const mult = DECAY_MULT[mode];
    // Simulate long actions (shifts, sleep) in 15-minute steps so effects like
    // starving only apply from the moment hunger actually runs out.
    const steps = Math.max(1, Math.ceil(dm / 15));
    const hours = dm / 60 / steps;
    for (let i = 0; i < steps; i++) {
      for (const k of NEED_KEYS) {
        let rate = NEED_DECAY[k] * mult[k];
        if (k === "energy" && mode !== "sleep" && n.hunger <= 0) rate *= 2;
        n[k] = clamp(n[k] - rate * hours);
      }
    }
    if (mode === "awake") {
      const warn: Record<NeedKey, string> = {
        hunger: "You're starving. Grab some food.",
        energy: "You're knackered. Get some sleep.",
        hygiene: "You're starting to smell. Shower time.",
        fun: "You're bored out of your mind.",
        social: "You're lonely. Go talk to someone.",
      };
      for (const k of NEED_KEYS) if (start[k] >= 20 && n[k] < 20) toast(warn[k], "bad");
    }
    set({ minutes: after, needs: n });
    for (let d = dayOf(before) + 1; d <= dayOf(after); d++) {
      onNewDay(d);
      if (get().phase !== "playing") return;
    }
    if (after >= get().weatherUntil) rollWeather(after);
    if (mode === "awake" && n.energy <= 0) passOut();
  };

  const passOut = () => {
    fade("You passed out…");
    set((s) => ({ area: "albion", teleport: { ...FLAT_DOOR, key: uid++ }, needs: { ...s.needs, energy: 35 } }));
    tick(6 * 60, "sleep");
    message("Mo (Kwik Mart)", "Saw you asleep on the bench last night. Got you home. You owe me a meal deal.");
  };

  const say = (who: DialogLine["who"], text: string) => set((s) => ({ dialog: [...s.dialog, { who, text }].slice(-6) }));

  return {
    phase: "title",
    profile: {
      name: "",
      background: "skint",
      look: { skin: "#c68a63", hair: "#20160f", jacket: "#1e3a5f", trousers: "#22252c", hairStyle: "short", gender: "male" },
    },
    toasts: [],
    draftLook: null,
    settings: loadSettings(),
    ...freshGame(),

    setDraftLook: (l) => set({ draftLook: l }),

    startGame: (profile) => {
      set({ ...freshGame(), profile, phase: "playing", money: BACKGROUNDS[profile.background].money, teleport: { ...SPAWN, key: uid++ } });
      setTimeout(() => {
        message("Kev (Landlord)", "Alright, it's Kev. Room's at 27 Albion Road, across the road from the station and up a bit. Red door, key's under the mat. Rent's £185 a week, due Sunday night. Cheers.");
      }, 1800);
      setTimeout(() => message("Mum", `Text me when you get there!! Wrap up warm, it's meant to rain. Love Mum xx`), 5200);
    },

    restart: () => set({ ...freshGame(), phase: "title" }),

    travel: (to, fromStation) => {
      const s = get();
      if (to === s.area || s.phase !== "playing") return;
      const tube = tubeRunning(hourOf(s.minutes));
      const fare = tube ? TUBE_FARE : NIGHT_BUS_FARE;
      const minutes = Math.round(travelMinutes(s.area, to) * (tube ? 1 : 1.8)) + (fromStation ? 0 : 10);
      if (!spend(fare, tube ? `Tube to ${AREAS[to].name}` : `Night bus to ${AREAS[to].name}`)) return;
      set({ panel: null, phoneOpen: false });
      fade(tube ? "Mind the gap…" : "Night bus. Someone is eating chips.");
      tick(minutes);
      if (get().phase !== "playing") return;
      const first = !s.visited[to];
      // swap districts once the fade is on screen, so the rebuild happens behind it
      setTimeout(() => {
        if (get().phase !== "playing") return;
        set((st) => ({ area: to, visited: { ...st.visited, [to]: true }, teleport: { ...SPAWN, key: uid++ } }));
        toast(first ? `Welcome to ${AREAS[to].name}! ${AREAS[to].tagline}` : `${AREAS[to].name}, ${AREAS[to].postcode}`, "good");
      }, 300);
    },

    tick,

    setNearby: (nb) => {
      const s = get();
      if (s.nearby?.id === nb?.id && s.nearby?.kind === nb?.kind) return;
      set({ nearby: nb });
      if (nb?.id === "flat" && !s.visitedFlat) {
        set({ visitedFlat: true });
        toast("Home sweet home. It's… cosy.", "good");
      }
    },

    interact: () => {
      const s = get();
      if (!s.nearby || s.panel || s.phase !== "playing") return;
      get().openPanel({ kind: s.nearby.kind, id: s.nearby.id } as Panel);
    },

    openPanel: (p) => {
      if (p?.kind === "npc") {
        const s = get();
        const npc = npcById(p.id);
        const rel = s.rel[p.id] ?? 0;
        const greet = !s.met[p.id]
          ? npc.intro
          : rel >= 50 ? pick(["There they are!", "Oi oi! Alright?", "My favourite neighbour."])
          : rel < 0 ? pick(["Oh. It's you.", "What now?"])
          : pick(["Alright?", "Oh, hiya.", "You again! Go on then."]);
        set({ panel: p, dialog: [{ who: "npc", text: greet }], met: { ...s.met, [p.id]: true }, phoneOpen: false });
        return;
      }
      set({ panel: p, phoneOpen: false });
    },

    closePanel: () => set({ panel: null, dialog: [] }),

    doPlaceAction: (placeId, actionId) => {
      const s = get();
      const place = placeById(placeId);
      const action = place.actions.find((a) => a.id === actionId)!;
      const hour = hourOf(s.minutes);
      if (!isOpen(place, hour) && action.special !== "work") {
        toast(`${place.name} is closed. Opens at ${fmtHour(place.hours![0])}.`, "bad");
        return;
      }

      switch (action.special) {
        case "sleep": {
          const night = hour >= 20 || hour < 7;
          const mins = night ? (hour < 7 ? (7 - hour) * 60 : (24 - hour + 7) * 60) : 120;
          set({ panel: null });
          fade(night ? "Zzz… (until 7am)" : "Power nap…");
          tick(Math.round(mins), "sleep");
          toast(night ? `Morning! It's ${weekdayOf(get().minutes)}.` : "Nap done. Feeling human again.", "good");
          return;
        }
        case "work": {
          if (!s.job || JOBS[s.job].placeId !== placeId) {
            toast("You don't work here. Try the Job Centre or your phone.", "bad");
            return;
          }
          const job = JOBS[s.job];
          const day = dayOf(s.minutes);
          if (s.lastShiftDay === day) { toast("You've already done today's shift.", "bad"); return; }
          if (hour < job.start - 1) { toast(`Your shift starts at ${fmtHour(job.start)}. Come back then.`, "bad"); return; }
          if (hour >= job.end - 1) { toast("Your shift's basically over. Tomorrow, yeah?", "bad"); return; }
          const late = hour > job.start + 0.25;
          const endAt = (day - 1) * 1440 + job.end * 60;
          const paidHours = job.end - Math.max(hour, job.start);
          const tips = job.tips ? Math.round((job.tips[0] + Math.random() * (job.tips[1] - job.tips[0])) * (mood(s.needs) / 60)) : 0;
          const pay = +(paidHours * job.hourly + tips).toFixed(2);
          set({ panel: null, lastShiftDay: day, shiftsWorked: s.shiftsWorked + 1 });
          fade(`On shift at ${job.employer}…`);
          tick(endAt - s.minutes, "work");
          earn(pay, `${job.employer} wages${tips ? ` + £${tips} tips` : ""}`);
          toast(`Shift done. +${fmtMoney(pay)}`, "good");
          if (late) message(job.employer, "You were late today. Don't make it a habit, yeah?");
          return;
        }
        case "rent": get().payRent(); return;
        case "scratchcard": {
          if (!spend(2, "Scratchcard")) return;
          const r = Math.random();
          const win = r < 0.002 ? 500 : r < 0.02 ? 50 : r < 0.1 ? 10 : r < 0.3 ? 2 : 0;
          if (win) { earn(win, "Scratchcard win"); toast(win >= 50 ? `WINNER! +£${win}! Mo is screaming.` : `You won £${win}!`, "good"); addNeeds({ fun: win >= 10 ? 15 : 4 }); }
          else { toast("Not a winner. Mo shrugs.", "bad"); addNeeds({ fun: -2 }); }
          return;
        }
        case "tube": set({ panel: { kind: "tube" } }); return;
        case "suit": {
          if (s.hasSuit) { toast("You've already got a suit. Hartley tuts.", "bad"); return; }
          if (!spend(action.price!, "Hartley & Sons: suit")) return;
          set({ panel: null, hasSuit: true });
          fade(action.fade ?? "…");
          tick(action.minutes);
          toast("You look like you own a yacht. You do not.", "good");
          return;
        }
        case "vintage": {
          if (!spend(action.price!, "Rewind Vintage: jacket")) return;
          const jackets = ["#7c2d12", "#14532d", "#6b4f2a", "#111111", "#1e3a5f", "#9d174d", "#a16207", "#3f3f46"].filter((c) => c !== s.profile.look.jacket);
          const jacket = jackets[Math.floor(Math.random() * jackets.length)];
          set({ panel: null, profile: { ...s.profile, look: { ...s.profile.look, jacket } } });
          fade(action.fade ?? "…");
          tick(action.minutes);
          addNeeds({ fun: 12 });
          toast("New (old) jacket. Smells faintly of 1987.", "good");
          return;
        }
        case "bus": {
          set({ panel: null });
          fade("Waiting…");
          tick(20);
          addNeeds({ fun: -3 });
          toast("The 38 was 'due in 2 mins' for 20 minutes. You give up.", "bad");
          return;
        }
        case "atm": toast(`Balance: ${fmtMoney(s.money)}. The machine charges you £0. Miracle.`); return;
        case "jobs": set({ panel: { kind: "jobs" } }); tick(5); return;
        case "callMum": {
          if (!spend(0.6, "Phone box")) return;
          set({ panel: null });
          fade("Ring ring…");
          tick(15);
          addNeeds({ social: 15, fun: 5 });
          const week = currentWeek(s.minutes);
          if (s.money < 60 && s.mumPaidWeek !== week) {
            set({ mumPaidWeek: week });
            earn(30, "Mum");
            message("Mum", "Sent you £30. Eat something with a vegetable in it please. Love you xx");
          } else toast("Mum talked about next door's cat for 15 minutes. Lovely.", "good");
          return;
        }
      }

      if (action.price && !spend(action.price, `${place.name}: ${action.label}`)) return;
      const long = action.minutes >= 15;
      if (long) { set({ panel: null }); fade(action.fade ?? `${action.label}…`); }
      tick(action.minutes);
      if (action.needs) addNeeds(action.needs);
      toast(action.toast ?? `${action.label}${action.price ? ` (${fmtMoney(action.price)})` : ""}`, "good");
    },

    talk: (npcId, topic) => {
      const s = get();
      const npc = npcById(npcId);
      const key = `${npcId}:${topic}`;
      const prevRel = s.rel[npcId] ?? 0;
      const m = mood(s.needs);
      const smelly = s.needs.hygiene < 25;
      const optionText: Record<Topic, string> = {
        weather: "Talk about the weather",
        banter: "Have some banter",
        work: "Ask about work",
        pub: "Fancy a pint?",
        flirt: "Flirt",
      };
      say("you", optionText[topic]);
      let delta = 0;

      if (s.topicAt[key] !== undefined && s.minutes - s.topicAt[key] < 60 && topic !== "work") {
        say("npc", pick(LINES.repeat));
      } else if (topic === "weather") {
        const good = npc.likes.weather >= 0;
        delta = good ? 3 + npc.likes.weather * 5 : 1;
        say("npc", pick(good ? LINES.weatherGood : LINES.weatherBad));
      } else if (topic === "banter") {
        const chance = 0.5 + npc.likes.banter * 0.35 + (m - 50) / 250 - (smelly ? 0.2 : 0);
        const ok = Math.random() < chance;
        delta = ok ? 10 : -6;
        say("npc", pick(ok ? LINES.banterGood : LINES.banterBad));
      } else if (topic === "flirt") {
        if (prevRel < 20) { delta = -4; say("npc", "Bit forward, aren't you? We've only just met."); }
        else {
          const ok = Math.random() < 0.35 + npc.likes.flirt * 0.4 + (m - 50) / 250 - (smelly ? 0.3 : 0);
          delta = ok ? 12 : -10;
          say("npc", pick(ok ? LINES.flirtGood : LINES.flirtBad));
        }
      } else if (topic === "work") {
        delta = 1;
        say("npc", npc.workTip);
      } else if (topic === "pub") {
        if (prevRel < 35) { delta = -2; say("npc", pick(LINES.pubNo)); }
        else if (s.money < 12.8) { say("narrator", "You check your balance. Two pints is £12.80. Awkward."); }
        else {
          say("npc", pick(LINES.pubYes));
          spend(12.8, `Rose & Crown: pints with ${npc.name}`);
          set({ panel: null, dialog: [] });
          fade(`Down the pub with ${npc.name}…`);
          tick(90);
          addNeeds({ social: 35, fun: 20, energy: -6 });
          delta = 15;
          toast(`Great night with ${npc.name}.`, "good");
        }
      }

      if (smelly && topic !== "pub" && delta > 0) { delta = Math.floor(delta / 2); say("narrator", LINES.smelly[0]); }
      const rel = clamp(prevRel + delta, -100, 100);
      set((st) => ({ rel: { ...st.rel, [npcId]: rel }, topicAt: { ...st.topicAt, [key]: st.minutes } }));
      if (topic !== "pub") {
        tick(10);
        addNeeds({ social: 5 + Math.max(0, delta) * 0.6, fun: delta > 5 ? 3 : 0 });
      }
      if (relationshipTier(rel) !== relationshipTier(prevRel) && rel > prevRel) toast(`${npc.name} is now: ${relationshipTier(rel)}`, "good");
    },

    applyJob: (id) => {
      const s = get();
      if (s.job === id) { toast("You already work there."); return; }
      const job = JOBS[id];
      if (job.requires?.suit && !s.hasSuit) { toast(`${job.employer} only hires people in a suit. Try Hartley & Sons in the City.`, "bad"); return; }
      if (job.requires?.shifts && s.shiftsWorked < job.requires.shifts) {
        toast(`${job.employer} wants experience: ${job.requires.shifts} shifts worked (you have ${s.shiftsWorked}).`, "bad");
        return;
      }
      if (s.needs.hygiene < 25 && job.placeId) {
        toast(`${job.employer} took one sniff and said they'll "keep your CV on file".`, "bad");
        return;
      }
      set({ job: id, panel: null });
      toast(`Hired! ${job.title} at ${job.employer}.`, "good");
      message(job.employer, job.placeId
        ? `Welcome aboard! Shifts are ${fmtHour(job.start)}–${fmtHour(job.end)}. Come to ${placeById(job.placeId).name} (${AREAS[placeById(job.placeId).area].name}) and don't be late.`
        : "You're in! Open the Jobs app any time to do a delivery run. Rain = surge pay.");
    },

    quitJob: () => {
      const s = get();
      if (!s.job) return;
      toast(`You quit ${JOBS[s.job].employer}. Bold.`);
      set({ job: null });
    },

    deliveryRun: () => {
      const s = get();
      if (s.job !== "rider") return;
      if (s.needs.energy < 10) { toast("You're too knackered to ride.", "bad"); return; }
      const surge = s.weather === "rain" ? 5 : s.weather === "drizzle" ? 2.5 : 0;
      const pay = +(6 + Math.random() * 6 + surge).toFixed(2);
      set({ phoneOpen: false });
      fade("Out on the bike…");
      tick(60, "work");
      addNeeds({ hygiene: surge ? -6 : -2 });
      earn(pay, "NoshRun delivery");
      toast(`Delivery run done. +${fmtMoney(pay)}${surge ? " (rain surge!)" : ""}`, "good");
    },

    payRent: () => {
      const s = get();
      const owed = rentOwedWeeks(s);
      if (owed === 0) { toast("You're paid up this week. Kev is almost smiling.", "good"); return; }
      if (!spend(WEEKLY_RENT, "Rent to Kev")) return;
      const paid = s.rentWeeksPaid + 1;
      // Strikes clear once every past week is paid off.
      set({ rentWeeksPaid: paid, rentStrikes: paid >= currentWeek(s.minutes) - 1 ? 0 : s.rentStrikes });
      toast(`Rent paid (${fmtMoney(WEEKLY_RENT)}).`, "good");
      message("Kev (Landlord)", "Got it. Cheers. Don't touch the thermostat.");
    },

    togglePhone: (open) => set((s) => ({ phoneOpen: open ?? !s.phoneOpen, phoneApp: "home", panel: open === false ? s.panel : null })),
    setPhoneApp: (a) => { set({ phoneApp: a }); if (a === "messages") get().readAll(); },
    toast,
    message,
    readAll: () => set((s) => ({ messages: s.messages.map((m) => ({ ...m, read: true })) })),
    setQuality: (q) => { const settings = { ...get().settings, quality: q }; set({ settings }); saveSettings(settings); },
    setVolume: (v) => { const settings = { ...get().settings, volume: v }; set({ settings }); saveSettings(settings); },
  };
});

// Where the floating objective marker should point. If the target is in another district,
// point at this district's station instead.
type ObjectiveState = Pick<State, "visitedFlat" | "job" | "minutes" | "lastShiftDay" | "area">;
export function objectiveTarget(s: ObjectiveState): { x: number; z: number; label: string } | null {
  const route = (placeId: string, label: string) => {
    const p = placeById(placeId);
    const target = p.area === s.area ? p : placeById(AREAS[s.area].station);
    const text = p.area === s.area ? label : `${label}: Tube to ${AREAS[p.area].name}`;
    return { x: target.x, z: target.z ?? (target.side === "n" ? 8.6 : -8.6), label: text };
  };
  if (!s.visitedFlat) return route("flat", "Find your flat");
  if (!s.job) return route("jobcentre", "Get a job");
  const job = JOBS[s.job];
  if (job.placeId) {
    const h = hourOf(s.minutes);
    if (s.lastShiftDay !== dayOf(s.minutes) && h >= job.start - 1.5 && h < job.end - 1) return route(job.placeId, "Go to work");
  }
  return null;
}

// Dev-only handle for debugging and automated screenshots.
if (import.meta.env.DEV) (window as unknown as { __store: typeof useGame }).__store = useGame;
