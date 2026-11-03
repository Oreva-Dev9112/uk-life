import { useEffect, useRef, type ReactNode } from "react";
import { useGame, fmtMoney, fmtHour, hourOf } from "../state/store";
import { AREAS, JOBS, NEED_INFO, isOpen, npcById, placeById, relationshipTier, type JobId, type NeedKey, type Topic } from "../state/content";
import { TubeMap } from "./TubeMap";
import { Icon } from "./Icon";
import { audio } from "../game/systems/audio";

function Sheet({ children, onClose, title, subtitle, badge }: { children: ReactNode; onClose: () => void; title: string; subtitle?: string; badge?: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-1/2 sm:w-[23rem] sm:-translate-y-1/2">
      <div className="glass max-h-[70vh] overflow-y-auto rounded-3xl p-5 animate-rise">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/55">{subtitle}</p>}
            {badge}
          </div>
          <button onClick={() => { onClose(); audio.blip(false); }} className="rounded-full p-2 text-white/60 transition hover:bg-white/10" aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Effects({ needs }: { needs?: Partial<Record<NeedKey, number>> }) {
  if (!needs) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {(Object.entries(needs) as [NeedKey, number][]).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${NEED_INFO[k].color}1f`, color: v >= 0 ? NEED_INFO[k].color : "#fca5a5" }}>
          <Icon name={k} size={11} />{v > 0 ? "+" : ""}{v}
        </span>
      ))}
    </div>
  );
}

export function PlacePanel({ id }: { id: string }) {
  const place = placeById(id);
  const money = useGame((s) => s.money);
  const minutes = useGame((s) => s.minutes);
  const job = useGame((s) => s.job);
  const close = useGame((s) => s.closePanel);
  const act = useGame((s) => s.doPlaceAction);
  const open = isOpen(place, hourOf(minutes));
  const badge = place.hours ? (
    <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${open ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-400" : "bg-red-400"}`} />
      {open ? "Open" : "Closed"} · {fmtHour(place.hours[0])}–{fmtHour(place.hours[1] % 24)}
    </span>
  ) : null;
  return (
    <Sheet title={place.name} subtitle={place.tagline} onClose={close} badge={badge}>
      <div className="space-y-2">
        {place.actions.map((a) => {
          if (a.special === "work" && (!job || JOBS[job].placeId !== id)) return null;
          const cantAfford = !!a.price && money < a.price;
          return (
            <button
              key={a.id}
              onClick={() => { act(id, a.id); audio.blip(); }}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/10 active:scale-[0.99] ${cantAfford ? "opacity-50" : ""}`}
            >
              <div className="min-w-0">
                <div className="font-semibold">{a.label}</div>
                {a.desc && <div className="text-xs text-white/50">{a.desc}</div>}
                <Effects needs={a.needs} />
              </div>
              <div className="shrink-0 text-right">
                {a.price ? <div className="font-display font-semibold tabular">{fmtMoney(a.price)}</div> : null}
                {a.minutes >= 15 && <div className="text-[11px] text-white/45">{a.minutes} min</div>}
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function JobList() {
  const job = useGame((s) => s.job);
  const apply = useGame((s) => s.applyJob);
  const quit = useGame((s) => s.quitJob);
  const deliveryRun = useGame((s) => s.deliveryRun);
  return (
    <div className="space-y-2">
      {(Object.keys(JOBS) as JobId[]).map((id) => {
        const j = JOBS[id];
        const mine = job === id;
        return (
          <div key={id} className={`rounded-2xl border p-3.5 ${mine ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/8 bg-white/5"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{j.title} <span className="font-normal text-white/50">· {j.employer}</span></div>
                <div className="text-xs text-white/55">{j.placeId ? `${fmtHour(j.start)}–${fmtHour(j.end % 24)} · ${fmtMoney(j.hourly)}/hr${j.tips ? " + tips" : ""} · ${AREAS[placeById(j.placeId).area].name}` : "Any time · £6–£17 per run · anywhere"}</div>
                {j.requires && !mine && (
                  <div className="mt-0.5 text-[11px] text-amber-300/90">Needs: {[j.requires.suit && "a suit", j.requires.shifts && `${j.requires.shifts} shifts' experience`].filter(Boolean).join(" + ")}</div>
                )}
              </div>
              {mine ? (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Your job</span>
              ) : (
                <button onClick={() => { apply(id); audio.blip(); }} className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-white/85">Apply</button>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-snug text-white/60">{j.blurb}</p>
            {mine && (
              <div className="mt-2.5 flex gap-2">
                {id === "rider" && <button onClick={deliveryRun} className="rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold hover:bg-brand-dark">Do a delivery run (1 hr)</button>}
                <button onClick={quit} className="rounded-xl bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/15">Quit</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TubePanel() {
  const close = useGame((s) => s.closePanel);
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/45 p-3" onClick={close}>
      <div className="glass max-h-[94vh] w-full max-w-md overflow-y-auto rounded-3xl p-4 animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Where to?</h2>
            <p className="text-sm text-white/55">Tap a station. Fares are pay as you go.</p>
          </div>
          <button onClick={() => { close(); audio.blip(false); }} className="rounded-full p-2 text-white/60 hover:bg-white/10" aria-label="Close"><Icon name="x" /></button>
        </div>
        <TubeMap fromStation />
      </div>
    </div>
  );
}

export function JobsPanel() {
  const close = useGame((s) => s.closePanel);
  return (
    <Sheet title="Job Centre" subtitle="Who's hiring on Albion Road" onClose={close}>
      <JobList />
    </Sheet>
  );
}

const TOPICS: { id: Topic; label: string; icon: string; needs?: number }[] = [
  { id: "weather", label: "Talk about the weather", icon: "rain" },
  { id: "banter", label: "Have some banter", icon: "fun" },
  { id: "work", label: "Ask about work", icon: "briefcase" },
  { id: "pub", label: "Fancy a pint? (£12.80)", icon: "beer", needs: 35 },
  { id: "flirt", label: "Flirt", icon: "heart", needs: 20 },
];

export function DialogPanel({ id }: { id: string }) {
  const npc = npcById(id);
  const rel = useGame((s) => s.rel[id] ?? 0);
  const dialog = useGame((s) => s.dialog);
  const talk = useGame((s) => s.talk);
  const close = useGame((s) => s.closePanel);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [dialog.length]);
  const pct = (rel + 100) / 2;
  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 mx-auto max-w-xl sm:bottom-6">
      <div className="glass rounded-3xl p-4 sm:p-5 animate-rise">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-xl font-bold" style={{ background: npc.look.jacket }}>
            {npc.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl font-bold">{npc.name}</span>
              <span className="truncate text-sm text-white/50">{npc.age} · {npc.role}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: rel < 0 ? "#ef4444" : "linear-gradient(90deg,#a78bfa,#f472b6)" }} />
              </div>
              <span className="w-24 text-right text-xs text-white/60">{relationshipTier(rel)}</span>
            </div>
          </div>
          <button onClick={() => { close(); audio.blip(false); }} className="self-start rounded-full p-2 text-white/60 hover:bg-white/10" aria-label="Leave"><Icon name="x" /></button>
        </div>
        <div ref={logRef} className="mb-3 max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {dialog.map((l, i) => (
            <div key={i} className={`flex ${l.who === "you" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${l.who === "you" ? "rounded-br-md bg-brand/85" : l.who === "narrator" ? "bg-transparent px-1 italic text-white/50" : "rounded-bl-md bg-white/10"}`}>
                {l.text}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOPICS.map((t) => {
            const locked = t.needs !== undefined && rel < t.needs;
            return (
              <button
                key={t.id}
                onClick={() => { talk(id, t.id); audio.blip(); }}
                className={`flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-left text-sm font-medium transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98] ${locked ? "text-white/40" : ""}`}
                title={locked ? `Needs a better relationship (${t.needs}+)` : undefined}
              >
                <Icon name={locked ? "lock" : t.icon} size={15} className={locked ? "" : "text-white/60"} />
                <span className="leading-tight">{t.label}</span>
              </button>
            );
          })}
          <button onClick={() => { close(); audio.blip(false); }} className="rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/15">Cheers, see you</button>
        </div>
      </div>
    </div>
  );
}
