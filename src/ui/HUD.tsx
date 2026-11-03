import { useGame, fmtMoney, fmtTime, weekdayOf, dayOf, rentOwedWeeks, WEATHER_LABEL, objectiveTarget } from "../state/store";
import { AREAS, NEED_INFO, NEED_KEYS, JOBS, WEEKLY_RENT, type NeedKey } from "../state/content";
import { Icon } from "./Icon";
import { audio } from "../game/systems/audio";

const WEATHER_ICON = { rain: "rain", drizzle: "rain", overcast: "cloud", clear: "sun" } as const;

export function TopBar() {
  const money = useGame((s) => s.money);
  const minutes = useGame((s) => s.minutes);
  const weather = useGame((s) => s.weather);
  const area = useGame((s) => s.area);
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-wrap items-start gap-2 sm:left-4 sm:top-4">
      <div className="glass flex items-center gap-2 rounded-2xl px-3.5 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"><Icon name="pound" size={14} /></span>
        <span className={`font-display text-lg font-semibold tabular ${money < 20 ? "text-red-300" : ""}`}>{fmtMoney(money)}</span>
      </div>
      <div className="glass flex items-center gap-2 rounded-2xl px-3.5 py-2">
        <Icon name="clock" size={16} className="text-white/60" />
        <span className="font-display text-lg font-semibold tabular">{fmtTime(minutes)}</span>
        <span className="hidden text-sm text-white/55 sm:inline">{weekdayOf(minutes)} · Day {dayOf(minutes)}</span>
        <span className="text-sm text-white/55 sm:hidden">{weekdayOf(minutes).slice(0, 3)}</span>
      </div>
      <div className="glass hidden items-center gap-2 rounded-2xl px-3.5 py-2 sm:flex">
        <Icon name="map" size={16} className="text-white/60" />
        <span className="text-sm font-medium text-white/85">{AREAS[area].name}</span>
        <span className="text-sm text-white/45">{AREAS[area].postcode}</span>
      </div>
      {/* (weather waits for lg: below that it wraps onto a second row, under the goals) */}
      <div className="glass hidden items-center gap-2 rounded-2xl px-3.5 py-2 lg:flex">
        <Icon name={WEATHER_ICON[weather]} size={16} className="text-sky-200/80" />
        <span className="text-sm text-white/75">{WEATHER_LABEL[weather]}</span>
      </div>
    </div>
  );
}

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
  const target = objectiveTarget(s);
  const visible = goals.filter((g) => !g.done).slice(0, 3);
  return (
    // On touch screens the needs strip sits under the top bar, so the goals go below it.
    <div className={`pointer-events-none absolute left-3 hidden w-64 sm:left-4 sm:block ${touch ? "top-[6.6rem]" : "top-[4.2rem]"}`}>
      <div className="glass rounded-2xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Goals</span>
          {target && <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-300"><Icon name="target" size={12} />{target.label}</span>}
        </div>
        <ul className="space-y-1.5">
          {visible.map((g) => (
            <li key={g.label} className="flex items-start gap-2 text-sm leading-snug text-white/85">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {g.label}
            </li>
          ))}
          {goals.filter((g) => g.done).slice(-2).map((g) => (
            <li key={g.label} className="flex items-start gap-2 text-sm leading-snug text-white/35 line-through">
              <Icon name="check" size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              {g.label}
            </li>
          ))}
        </ul>
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
        <div className="mb-0.5 hidden justify-between text-[11px] text-white/55 sm:flex">
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

export function Needs({ touch }: { touch: boolean }) {
  const needs = useGame((s) => s.needs);
  if (touch) {
    // Phones: one compact strip under the top bar.
    return (
      <div className="pointer-events-none absolute left-3 right-3 top-[3.9rem]">
        <div className="glass flex gap-2 rounded-2xl px-2.5 py-2">
          {NEED_KEYS.map((k) => {
            const v = needs[k], info = NEED_INFO[k];
            return (
              <div key={k} className="flex min-w-0 flex-1 items-center gap-1" title={info.label}>
                <Icon name={k} size={13} className={v < 20 ? "animate-pulse-soft text-red-400" : ""} />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${v}%`, background: v < 20 ? "#ef4444" : info.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 w-56">
      <div className="glass space-y-2 rounded-2xl p-3">
        {NEED_KEYS.map((k) => <NeedBar key={k} k={k} v={needs[k]} />)}
      </div>
    </div>
  );
}

export function InteractPrompt({ touch }: { touch: boolean }) {
  const nearby = useGame((s) => s.nearby);
  const panel = useGame((s) => s.panel);
  const phoneOpen = useGame((s) => s.phoneOpen);
  const interact = useGame((s) => s.interact);
  if (!nearby || panel || phoneOpen) return null;
  return (
    // Desktop: centred in the space right of the needs panel, until the screen is wide enough to clear it.
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center ${touch ? "bottom-40" : "bottom-8 pl-[15.5rem] pr-4 lg:px-0"}`}>
      <button
        onClick={() => { interact(); audio.blip(); }}
        className="glass pointer-events-auto flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5 text-left transition hover:bg-white/10 active:scale-[0.98] animate-rise"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white font-display text-lg font-bold text-ink">{touch ? <Icon name={nearby.kind === "npc" ? "chat" : "walk"} /> : "E"}</span>
        <span>
          <span className="block font-display text-base font-semibold leading-tight">{nearby.label}</span>
          {nearby.sub && <span className="block text-xs text-white/55">{nearby.sub}</span>}
        </span>
      </button>
    </div>
  );
}

export function Toasts({ touch }: { touch: boolean }) {
  const toasts = useGame((s) => s.toasts);
  // From sm the goals panel takes the top-left, so toasts sit to its right until lg, where a centred toast clears it.
  // Touch screens keep them below the needs strip.
  return (
    <div className={`pointer-events-none absolute left-1/2 top-[6.8rem] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-center gap-2 sm:left-[17.5rem] sm:right-4 sm:w-auto sm:translate-x-0 lg:left-1/2 lg:right-auto lg:w-[min(92vw,26rem)] lg:-translate-x-1/2 ${touch ? "" : "sm:top-[4.4rem]"}`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass rounded-xl px-4 py-2.5 text-center text-sm font-medium animate-rise ${t.tone === "good" ? "text-emerald-200" : t.tone === "bad" ? "text-red-200" : "text-white/90"}`}
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

export function PhoneButton() {
  const unread = useGame((s) => s.messages.filter((m) => !m.read).length);
  const toggle = useGame((s) => s.togglePhone);
  const open = useGame((s) => s.phoneOpen);
  if (open) return null;
  return (
    <button
      onClick={() => { toggle(true); audio.blip(); }}
      className="glass pointer-events-auto absolute bottom-4 right-4 grid h-14 w-14 place-items-center rounded-2xl transition hover:bg-white/10 active:scale-95"
      aria-label="Open phone"
    >
      <Icon name="phone" size={24} />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold">{unread}</span>}
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
