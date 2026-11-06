import { useEffect, useState } from "react";
import { useGame, fmtMoney, fmtTime, weekdayOf, dayOf, hourOf, mood, realTimeAt, rentOwedWeeks, WEATHER_LABEL, objectiveTarget } from "../state/store";
import { AREAS, NEED_INFO, NEED_KEYS, JOBS, WEEKLY_RENT, npcById, relationshipTier, type NeedKey } from "../state/content";
import { londonDaylightAt } from "../state/london";
import { personPortrait, portrait } from "../game/portraits";
import type { Look } from "../game/actors/Character";
import { Icon } from "./Icon";
import { audio } from "../game/systems/audio";

// Vertical spots under the top bar (which grows by the notch on phones).
const BELOW_BAR = "top-[calc(3.6rem_+_env(safe-area-inset-top))]";
const BELOW_MOOD = "top-[calc(7.6rem_+_env(safe-area-inset-top))]"; // touch: the mood plate sits under the bar

const SKY_COLOR = { rain: "text-sky-300", cloud: "text-slate-200", sun: "text-amber-300", moon: "text-indigo-100" } as const;

// Full-width bar: money, the time with the sky (sun, moon, cloud or rain), and the day.
export function TopBar() {
  const money = useGame((s) => s.money);
  const minutes = useGame((s) => s.minutes);
  const weather = useGame((s) => s.weather);
  const area = useGame((s) => s.area);
  const syncedAt = useGame((s) => s.syncedAt);
  const syncMinutes = useGame((s) => s.syncMinutes);
  const daylight = londonDaylightAt(realTimeAt({ syncedAt, syncMinutes }, minutes));
  const h = hourOf(minutes);
  const day = h >= (daylight?.sunrise ?? 7.2) && h < (daylight?.sunset ?? 18.3);
  const sky = weather === "rain" || weather === "drizzle" ? "rain" : weather === "overcast" ? "cloud" : day ? "sun" : "moon";
  return (
    <div className="hudbar pointer-events-none absolute inset-x-0 top-0 grid grid-cols-3 items-center px-3 pb-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] font-display font-bold uppercase tracking-wide sm:px-5">
      <div className="flex items-center gap-1.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b from-amber-200 to-amber-500 text-amber-950 shadow"><Icon name="pound" size={14} stroke={2.6} /></span>
        <span className={`text-lg tabular ${money < 20 ? "text-red-300" : ""}`}>{fmtMoney(money).replace("£", "")}</span>
      </div>
      <div className="flex items-center justify-center gap-2 text-lg tabular" title={WEATHER_LABEL[weather]}>
        <Icon name={sky} size={20} className={SKY_COLOR[sky]} fill={sky === "sun" || sky === "moon" ? "currentColor" : "none"} />
        {fmtTime(minutes)}
        <span className="hidden text-xs font-semibold normal-case tracking-normal text-white/55 lg:inline">{WEATHER_LABEL[weather]}</span>
      </div>
      <div className="text-right text-sm sm:text-base">
        <span className="hidden font-semibold text-white/55 sm:inline">{AREAS[area].name} · </span>
        <span className="sm:hidden">{weekdayOf(minutes).slice(0, 3)}</span>
        <span className="hidden sm:inline">{weekdayOf(minutes)}</span>
        <span className="hidden font-semibold text-white/55 lg:inline"> · Day {dayOf(minutes)}</span>
      </div>
    </div>
  );
}

// The next goal (and the one after), under the top bar.
export function Goals({ touch }: { touch: boolean }) {
  const s = useGame();
  const anyMate = Object.values(s.rel).some((v) => v >= 50);
  const owed = rentOwedWeeks(s);
  const goals = [
    { label: "Find your flat — 27 Albion Road", done: s.visitedFlat },
    { label: s.job ? `Job: ${JOBS[s.job].title} at ${JOBS[s.job].employer}` : "Get a job", done: !!s.job },
    { label: "Make a mate", done: anyMate },
    { label: owed > 0 ? `Pay rent (£${WEEKLY_RENT * owed}) by Sunday` : "Rent paid this week", done: owed === 0 },
    { label: "Save £1,000", done: s.money >= 1000 },
  ];
  const undone = goals.filter((g) => !g.done);
  const target = objectiveTarget(s);
  // (the marker's label adds a route, like "Tube to Albion Park", or a nudge that it's time for work)
  const hint = target?.label.includes(": ") ? target.label.split(": ")[1] : target?.label === "Go to work" ? "Time to go to work" : null;
  if (!undone.length) return null;
  return (
    <div className={`pointer-events-none absolute left-3 hidden max-w-[17rem] sm:left-4 sm:block ${touch ? BELOW_MOOD : BELOW_BAR}`}>
      <div className="plate rounded-xl px-3 py-2">
        <div className="flex items-start gap-2 text-sm font-semibold leading-snug">
          <Icon name="target" size={15} className="mt-0.5 shrink-0 text-cyan-300" />
          {undone[0].label}
        </div>
        {hint && <div className="ml-[23px] text-xs font-semibold text-cyan-200">{hint}</div>}
        {undone[1] && <div className="ml-[23px] mt-1 text-xs text-white/50">Then: {undone[1].label}</div>}
      </div>
    </div>
  );
}

function NeedBar({ k, v }: { k: NeedKey; v: number }) {
  const info = NEED_INFO[k];
  const low = v < 20;
  return (
    <div className="flex items-center gap-2" title={`${info.label}: ${Math.round(v)}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${low ? "animate-pulse-soft" : ""}`} style={{ background: `${info.color}22`, color: info.color }}>
        <Icon name={k} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex justify-between text-[11px] text-white/60">
          <span>{info.label}</span>
          <span className="tabular">{Math.round(v)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: low ? "#ef4444" : info.color }} />
        </div>
      </div>
    </div>
  );
}

// Your face from your character model (drawn once it has loaded).
function usePersonPortrait(look: Look | null) {
  const key = JSON.stringify(look);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!look) return;
    let live = true;
    personPortrait(look).then((u) => live && setUrl(u), () => live && setUrl(portrait(look)));
    return () => { live = false; };
  }, [key]); // (look is a fresh object each time; key says when it really changed)
  return url;
}

const MOODS = [
  { min: 80, word: "Buzzing", from: "#34d399", to: "#047857" },
  { min: 65, word: "Happy", from: "#4ade80", to: "#15803d" },
  { min: 50, word: "Alright", from: "#bef264", to: "#4d7c0f" },
  { min: 35, word: "Meh", from: "#fcd34d", to: "#b45309" },
  { min: 20, word: "Fed up", from: "#fdba74", to: "#c2410c" },
  { min: -Infinity, word: "Miserable", from: "#fca5a5", to: "#b91c1c" },
];

// Your portrait and one mood bar. Needs running low flash beside your name; tap for the full breakdown.
export function Mood({ touch }: { touch: boolean }) {
  const needs = useGame((s) => s.needs);
  const look = useGame((s) => s.profile.look);
  const name = useGame((s) => s.profile.name);
  const [open, setOpen] = useState(false);
  const face = usePersonPortrait(look);
  const m = mood(needs);
  const tier = MOODS.find((t) => m >= t.min)!;
  const low = NEED_KEYS.filter((k) => needs[k] < 25);
  return (
    <div className={`pointer-events-none absolute left-3 flex gap-2 sm:left-4 ${touch ? "top-[calc(3.4rem_+_env(safe-area-inset-top))] flex-col" : "bottom-4 flex-col-reverse"}`}>
      <button onClick={() => setOpen((o) => !o)} className="pointer-events-auto flex items-end gap-2 text-left" aria-label="Show your needs" aria-expanded={open}>
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-white/85 bg-gradient-to-b from-sky-300 to-indigo-600 shadow-lg">
          {face && <img src={face} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="plate block w-44 rounded-xl px-2 pb-1.5 pt-1 sm:w-52">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-white/75">{name}</span>
            <span className="flex gap-1">{low.map((k) => <Icon key={k} name={k} size={13} className="animate-pulse-soft text-red-400" />)}</span>
          </span>
          <span className="relative mt-0.5 block h-6 overflow-hidden rounded-md bg-black/55 ring-1 ring-white/25">
            <span className="absolute inset-y-0 left-0 transition-[width] duration-500" style={{ width: `${m}%`, background: `linear-gradient(180deg, ${tier.from}, ${tier.to})` }} />
            <span className="relative block text-center font-display text-sm font-bold uppercase leading-6 tracking-wider [text-shadow:0_1px_2px_rgb(0_0_0/0.75)]">{tier.word}</span>
          </span>
        </span>
      </button>
      {open && (
        <div className="plate pointer-events-auto w-[15.5rem] space-y-2 rounded-xl p-3 animate-rise">
          {NEED_KEYS.map((k) => <NeedBar key={k} k={k} v={needs[k]} />)}
        </div>
      )}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name="star" size={15} stroke={1.2} fill="currentColor" className={i < n ? "text-amber-300" : "text-slate-600"} />
      ))}
    </span>
  );
}

// What you can do here: a name plate with a face and stars for people, a sign for places.
export function InteractPrompt({ touch }: { touch: boolean }) {
  const nearby = useGame((s) => s.nearby);
  const panel = useGame((s) => s.panel);
  const phoneOpen = useGame((s) => s.phoneOpen);
  const interact = useGame((s) => s.interact);
  const rel = useGame((s) => (s.nearby?.kind === "npc" ? s.rel[s.nearby.id] ?? 0 : 0));
  const met = useGame((s) => (s.nearby?.kind === "npc" ? !!s.met[s.nearby.id] : false));
  const npc = nearby?.kind === "npc" ? npcById(nearby.id) : null;
  const face = usePersonPortrait(npc ? npc.look : null);
  if (!nearby || panel || phoneOpen) return null;
  return (
    // Desktop: above the mood plate until the screen is wide enough to sit beside it.
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${touch ? "bottom-40" : "bottom-24 lg:bottom-6"}`}>
      <button
        onClick={() => { interact(); audio.blip(); }}
        className="plate pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pl-2 pr-2.5 text-left transition hover:brightness-110 active:scale-[0.98] animate-rise"
      >
        {npc ? (
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-white/85 bg-gradient-to-b from-amber-200 to-orange-500">
            {face && <img src={face} alt="" className="h-full w-full object-cover" />}
          </span>
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10"><Icon name="walk" size={22} /></span>
        )}
        <span className="min-w-0">
          <span className="block font-display text-base font-bold leading-tight">{npc && met ? npc.name : nearby.label}</span>
          {npc && met ? (
            <span className="mt-1 flex items-center gap-2">
              <Stars n={Math.max(0, Math.min(5, Math.round(rel / 20)))} />
              <span className="text-[11px] font-semibold text-white/60">{relationshipTier(rel)}</span>
            </span>
          ) : (
            nearby.sub && <span className="block text-xs text-white/60">{nearby.sub}</span>
          )}
        </span>
        <span className="ml-1 grid h-9 min-w-9 place-items-center rounded-lg bg-white px-2 font-display text-sm font-bold text-ink">
          {touch ? <Icon name={npc ? "chat" : "walk"} size={18} /> : "E"}
        </span>
      </button>
    </div>
  );
}

export function Toasts({ touch }: { touch: boolean }) {
  const toasts = useGame((s) => s.toasts);
  // From sm the goal sits at the top left, so toasts go to its right until lg, where a centred toast clears it.
  return (
    <div className={`pointer-events-none absolute left-1/2 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-center gap-2 sm:left-[18.5rem] sm:right-4 sm:w-auto sm:translate-x-0 lg:left-1/2 lg:right-auto lg:w-[min(92vw,26rem)] lg:-translate-x-1/2 ${touch ? BELOW_MOOD : BELOW_BAR}`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`plate rounded-xl px-4 py-2 text-center text-sm font-semibold animate-rise ${t.tone === "good" ? "text-emerald-200" : t.tone === "bad" ? "text-red-200" : "text-white"}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Fade() {
  const fade = useGame((s) => s.fade);
  if (!fade) return null;
  return (
    <div key={fade.key} className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/85 animate-fadein">
      <div className="font-display text-2xl font-semibold text-white/85 animate-pulse-soft">{fade.text}</div>
    </div>
  );
}

// A little phone in the corner, with a badge for unread messages.
export function PhoneButton() {
  const unread = useGame((s) => s.messages.filter((m) => !m.read).length);
  const toggle = useGame((s) => s.togglePhone);
  const open = useGame((s) => s.phoneOpen);
  if (open) return null;
  return (
    <button
      onClick={() => { toggle(true); audio.blip(); }}
      className="pointer-events-auto absolute bottom-4 right-4 h-[4.4rem] w-11 rounded-[0.85rem] border-2 border-slate-200/85 bg-gradient-to-b from-slate-600 to-slate-900 p-[3px] shadow-xl transition hover:brightness-110 active:scale-95"
      aria-label="Open phone"
    >
      <span className="flex h-full w-full items-end justify-center rounded-[0.6rem] bg-gradient-to-br from-sky-300 via-sky-500 to-indigo-700 pb-1">
        <span className="h-1 w-3 rounded-full bg-white/75" />
      </span>
      {unread > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold ring-2 ring-white/85">{unread}</span>}
    </button>
  );
}

export function GameOver() {
  const reason = useGame((s) => s.gameOverReason);
  const restart = useGame((s) => s.restart);
  const minutes = useGame((s) => s.minutes);
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 animate-fadein">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <div className="font-display text-sm font-semibold uppercase tracking-widest text-brand">Game over</div>
        <h2 className="mt-2 font-display text-3xl font-bold">Evicted.</h2>
        <p className="mt-3 text-white/70">{reason}</p>
        <p className="mt-2 text-sm text-white/45">You lasted {dayOf(minutes)} days in London.</p>
        <button onClick={restart} className="mt-6 rounded-2xl bg-brand px-6 py-3 font-display font-semibold hover:bg-brand-dark">Try again</button>
      </div>
    </div>
  );
}
