import { useEffect, useState } from "react";
import { useGame, fmtMoney, fmtTime, rentOwedWeeks, dayOf, objectiveTarget, type PhoneApp } from "../state/store";
import { AREAS, NPCS, WEEKLY_RENT, placesIn, relationshipTier } from "../state/content";
import { TubeMap } from "./TubeMap";
import { game } from "../game/Game";
import { Icon } from "./Icon";
import { JobList } from "./Panels";
import { audio } from "../game/systems/audio";

const APPS: { id: PhoneApp; label: string; icon: string; color: string }[] = [
  { id: "messages", label: "Messages", icon: "message", color: "#22c55e" },
  { id: "jobs", label: "Jobs", icon: "briefcase", color: "#f59e0b" },
  { id: "bank", label: "Bank", icon: "bank", color: "#6366f1" },
  { id: "map", label: "Map", icon: "map", color: "#0ea5e9" },
  { id: "contacts", label: "People", icon: "users", color: "#ec4899" },
  { id: "settings", label: "Settings", icon: "settings", color: "#64748b" },
];

export function Phone() {
  const open = useGame((s) => s.phoneOpen);
  const app = useGame((s) => s.phoneApp);
  const setApp = useGame((s) => s.setPhoneApp);
  const toggle = useGame((s) => s.togglePhone);
  const minutes = useGame((s) => s.minutes);
  const unread = useGame((s) => s.messages.filter((m) => !m.read).length);
  if (!open) return null;
  const title = APPS.find((a) => a.id === app)?.label;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-black/30 sm:inset-auto sm:bottom-4 sm:right-4 sm:bg-transparent" onClick={() => toggle(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mb-0 flex h-[min(640px,88vh)] w-full max-w-[22rem] flex-col overflow-hidden rounded-t-[2.2rem] border border-white/10 bg-[#0d1018] shadow-2xl sm:rounded-[2.4rem] animate-rise"
      >
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-xs font-semibold text-white/80">
          <span className="tabular">{fmtTime(minutes)}</span>
          <span className="h-5 w-20 rounded-full bg-black" />
          <span className="flex items-center gap-1">5G <span className="inline-block h-2.5 w-5 rounded-sm border border-white/60 p-px"><span className="block h-full w-3/4 rounded-[1px] bg-white/80" /></span></span>
        </div>
        {app !== "home" && (
          <div className="flex items-center gap-1 px-3 py-2">
            <button onClick={() => { setApp("home"); audio.blip(false); }} className="rounded-full p-1.5 text-white/70 hover:bg-white/10" aria-label="Back"><Icon name="back" /></button>
            <span className="font-display text-lg font-semibold">{title}</span>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {app === "home" && <Home onOpen={(a) => { setApp(a); audio.blip(); }} unread={unread} />}
          {app === "messages" && <Messages />}
          {app === "jobs" && <JobList />}
          {app === "bank" && <Bank />}
          {app === "map" && <MapApp />}
          {app === "contacts" && <Contacts />}
          {app === "settings" && <Settings />}
        </div>
        <button onClick={() => toggle(false)} className="mx-auto mb-2 h-1.5 w-32 rounded-full bg-white/40 hover:bg-white/70" aria-label="Close phone" />
      </div>
    </div>
  );
}

function Home({ onOpen, unread }: { onOpen: (a: PhoneApp) => void; unread: number }) {
  const name = useGame((s) => s.profile.name);
  const minutes = useGame((s) => s.minutes);
  return (
    <div className="pt-6">
      <div className="mb-8 text-center">
        <div className="font-display text-6xl font-bold tabular">{fmtTime(minutes)}</div>
        <div className="mt-1 text-sm text-white/55">Day {dayOf(minutes)} · {name}'s phone</div>
      </div>
      <div className="grid grid-cols-3 gap-y-6">
        {APPS.map((a) => (
          <button key={a.id} onClick={() => onOpen(a.id)} className="group flex flex-col items-center gap-1.5">
            <span className="relative grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg transition group-active:scale-95" style={{ background: `linear-gradient(160deg, ${a.color}, ${a.color}bb)` }}>
              <Icon name={a.icon} size={24} />
              {a.id === "messages" && unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold">{unread}</span>}
            </span>
            <span className="text-xs text-white/80">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Messages() {
  const messages = useGame((s) => s.messages);
  if (!messages.length) return <p className="mt-10 text-center text-sm text-white/45">No messages yet.</p>;
  return (
    <div className="space-y-2.5">
      {messages.map((m) => (
        <div key={m.id} className="rounded-2xl bg-white/6 p-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-white/85">{m.from}</span>
            <span className="text-white/40 tabular">Day {dayOf(m.at)} · {fmtTime(m.at)}</span>
          </div>
          <p className="text-sm leading-snug text-white/75">{m.text}</p>
        </div>
      ))}
    </div>
  );
}

function Bank() {
  const s = useGame();
  const owed = rentOwedWeeks(s);
  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-700 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-white/70">Current account</div>
        <div className="mt-1 font-display text-4xl font-bold tabular">{fmtMoney(s.money)}</div>
        <div className="mt-3 text-xs text-white/70">{s.profile.name} · Sort code 04-00-04</div>
      </div>
      <div className={`rounded-2xl border p-3.5 ${owed ? "border-amber-400/40 bg-amber-500/10" : "border-emerald-400/30 bg-emerald-500/10"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Rent to Kev</div>
            <div className="text-xs text-white/60">{owed ? `${fmtMoney(owed * WEEKLY_RENT)} due by Sunday night` : "Paid up this week"}{s.rentStrikes ? " · LATE" : ""}</div>
          </div>
          {owed > 0 && <button onClick={() => { s.payRent(); audio.blip(); }} className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-white/85">Pay £{WEEKLY_RENT}</button>}
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-white/45">Transactions</div>
      {s.txs.length === 0 && <p className="text-sm text-white/45">Nothing yet.</p>}
      {s.txs.map((t) => (
        <div key={t.id} className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
          <div className="min-w-0">
            <div className="truncate text-white/85">{t.label}</div>
            <div className="text-[11px] text-white/40">Day {dayOf(t.at)} · {fmtTime(t.at)}</div>
          </div>
          <span className={`font-display font-semibold tabular ${t.amount > 0 ? "text-emerald-300" : ""}`}>{t.amount > 0 ? "+" : ""}{fmtMoney(t.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function MapApp() {
  const [tab, setTab] = useState<"street" | "london">("london");
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/6 p-1">
        {(["london", "street"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-1.5 text-sm font-medium ${tab === t ? "bg-white text-ink" : "text-white/70"}`}>
            {t === "london" ? "London" : "This street"}
          </button>
        ))}
      </div>
      {tab === "london" ? <TubeMap fromStation={false} /> : <StreetMap />}
    </div>
  );
}

function StreetMap() {
  const s = useGame();
  const [pos, setPos] = useState({ x: 0, z: 0, f: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const p = game?.playerPosition();
      if (p) setPos({ x: p.x, z: p.z, f: game!.player.facing });
    }, 150);
    return () => clearInterval(id);
  }, []);
  const target = objectiveTarget(s);
  // map: x in [-90, 90] -> 0..180, z in [-12, 12] -> vertical, rotated so the street runs top-to-bottom
  const W = 300, H = 640;
  const toY = (x: number) => ((x + 90) / 180) * (H - 40) + 20;
  const toX = (z: number) => W / 2 - z * 5.5;
  return (
    <div>
      <p className="mb-2 text-xs text-white/50">{AREAS[s.area].name}, {AREAS[s.area].postcode} · You're the red arrow</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl bg-[#141822]">
        <rect x={toX(10)} y={10} width={toX(-10) - toX(10)} height={H - 20} fill="#262b37" />
        <rect x={toX(6)} y={10} width={toX(-6) - toX(6)} height={H - 20} fill="#1b1f29" />
        <line x1={W / 2} y1={14} x2={W / 2} y2={H - 14} stroke="#3b4150" strokeDasharray="10 12" />
        {placesIn(s.area).map((p) => {
          const z = p.z ?? (p.side === "n" ? 9.2 : -9.2);
          return (
            <g key={p.id}>
              <circle cx={toX(z)} cy={toY(p.x)} r={5} fill={p.kind === "flat" ? "#ef3340" : "#e5e7eb"} />
              <text x={toX(z) + (z > 0 ? -9 : 9)} y={toY(p.x) + 4} fontSize={10.5} fill="#cbd5e1" textAnchor={z > 0 ? "end" : "start"}>{p.name}</text>
            </g>
          );
        })}
        {target && <circle cx={toX(target.z)} cy={toY(target.x)} r={9} fill="none" stroke="#22d3ee" strokeWidth={2} className="animate-pulse-soft" />}
        <g transform={`translate(${toX(pos.z)} ${toY(pos.x)}) rotate(${(Math.atan2(-Math.cos(pos.f), -Math.sin(pos.f)) * 180) / Math.PI})`}>
          <path d="M0 -9 L6 6 L0 3 L-6 6 Z" fill="#ef3340" stroke="white" strokeWidth={1.5} />
        </g>
      </svg>
    </div>
  );
}

function Contacts() {
  const met = useGame((s) => s.met);
  const rel = useGame((s) => s.rel);
  const people = NPCS.filter((n) => met[n.id]);
  if (!people.length) return <p className="mt-10 text-center text-sm text-white/45">You haven't met anyone yet. Go say hello — people with names over their heads are up for a chat.</p>;
  return (
    <div className="space-y-2">
      {people.map((n) => {
        const v = rel[n.id] ?? 0;
        return (
          <div key={n.id} className="flex items-center gap-3 rounded-2xl bg-white/6 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl font-display font-bold" style={{ background: n.look.jacket }}>{n.name[0]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm"><span className="font-semibold">{n.name}</span><span className="text-white/50">{relationshipTier(v)}</span></div>
              <div className="text-xs text-white/45">{n.role}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-pink-400" style={{ width: `${(v + 100) / 2}%` }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Settings() {
  const settings = useGame((s) => s.settings);
  const setQuality = useGame((s) => s.setQuality);
  const setVolume = useGame((s) => s.setVolume);
  const restart = useGame((s) => s.restart);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-sm font-semibold">Graphics</div>
        <div className="grid grid-cols-2 gap-2">
          {(["high", "low"] as const).map((q) => (
            <button key={q} onClick={() => setQuality(q)} className={`rounded-xl py-2 text-sm font-medium capitalize ${settings.quality === q ? "bg-white text-ink" : "bg-white/8 text-white/70"}`}>{q}</button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-white/45">Low is smoother on phones. Shadows change after a reload. Resolution adjusts automatically if the game runs slowly (now {Math.round((game?.renderScale ?? 1) * 100)}%).</p>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon name="volume" size={16} /> Volume</div>
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => setVolume(+e.target.value)} className="w-full" />
      </div>
      <div className="border-t border-white/10 pt-4">
        {confirm ? (
          <div className="flex gap-2">
            <button onClick={restart} className="flex-1 rounded-xl bg-brand py-2 text-sm font-semibold">Yes, start over</button>
            <button onClick={() => setConfirm(false)} className="flex-1 rounded-xl bg-white/10 py-2 text-sm">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/8 py-2 text-sm text-white/70"><Icon name="refresh" size={15} /> Start a new life</button>
        )}
      </div>
    </div>
  );
}
