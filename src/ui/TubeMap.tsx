import { useState } from "react";
import { useGame, fmtMoney, hourOf } from "../state/store";
import {
  AREAS, COMING_SOON, JOBS, NIGHT_BUS_FARE, TUBE_FARE, TUBE_LINES,
  placeById, placesIn, travelMinutes, tubeRunning, type AreaId,
} from "../state/content";
import { audio } from "../game/systems/audio";

const isArea = (id: string): id is AreaId => id in AREAS;
const posOf = (id: string): [number, number] => (isArea(id) ? AREAS[id].map : COMING_SOON.find((c) => c.name === id)!.map);

// London as a Tube-style diagram: districts you can travel to, plus stops that open later.
export function TubeMap({ fromStation }: { fromStation: boolean }) {
  const area = useGame((s) => s.area);
  const minutes = useGame((s) => s.minutes);
  const job = useGame((s) => s.job);
  const money = useGame((s) => s.money);
  const travel = useGame((s) => s.travel);
  const [sel, setSel] = useState<AreaId | null>(null);
  const tube = tubeRunning(hourOf(minutes));
  const jobPlace = job ? JOBS[job].placeId : null;
  const jobArea = jobPlace ? placeById(jobPlace).area : null;

  const choose = (id: AreaId) => { setSel(id); audio.blip(); };
  const mins = sel && sel !== area ? Math.round(travelMinutes(area, sel) * (tube ? 1 : 1.8)) + (fromStation ? 0 : 10) : 0;
  const fare = tube ? TUBE_FARE : NIGHT_BUS_FARE;

  return (
    <div>
      <svg viewBox="0 0 400 400" className="w-full rounded-2xl" role="img" aria-label="Map of London">
        <rect width="400" height="400" rx="18" fill="#f7f5ef" />
        {/* parks */}
        <ellipse cx="52" cy="236" rx="34" ry="18" fill="#d3eac9" />
        <ellipse cx="118" cy="82" rx="36" ry="22" fill="#d3eac9" />
        <ellipse cx="352" cy="118" rx="30" ry="18" fill="#d3eac9" />
        <text x="118" y="70" fontSize="8" fill="#6b8f5e" textAnchor="middle">Regent's Park</text>
        <text x="352" y="104" fontSize="8" fill="#6b8f5e" textAnchor="middle">Victoria Park</text>
        {/* the Thames */}
        <path d="M -10 262 C 60 250, 90 300, 150 292 S 230 250, 270 276 S 340 330, 410 300" fill="none" stroke="#b9def2" strokeWidth="20" strokeLinecap="round" />
        <text x="214" y="275" fontSize="8" fill="#5b8fb0" fontStyle="italic" letterSpacing="2">RIVER THAMES</text>

        {/* lines */}
        {TUBE_LINES.map((l, i) => (
          <polyline
            key={i}
            points={l.stops.map((s) => posOf(s).join(",")).join(" ")}
            fill="none"
            stroke={l.color}
            strokeWidth={l.soon ? 4 : 7}
            strokeDasharray={l.soon ? "6 6" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={l.soon ? 0.7 : 1}
          />
        ))}

        {/* coming-soon stops */}
        {COMING_SOON.map((c) => (
          <g key={c.name} opacity={0.75}>
            <circle cx={c.map[0]} cy={c.map[1]} r="6" fill="#ffffff" stroke="#a1a1aa" strokeWidth="2.5" />
            <text x={c.map[0]} y={c.map[1] + 18} fontSize="9" fill="#71717a" textAnchor="middle">{c.name}</text>
            <text x={c.map[0]} y={c.map[1] + 28} fontSize="7" fill="#a1a1aa" textAnchor="middle">coming soon</text>
          </g>
        ))}

        {/* districts */}
        {(Object.keys(AREAS) as AreaId[]).map((id) => {
          const a = AREAS[id];
          const [x, y] = a.map;
          const here = id === area;
          const picked = id === sel;
          const labelBelow = y < 150; // (labels go above stations near the top edge)
          return (
            <g key={id} onClick={() => choose(id)} className="cursor-pointer">
              <circle cx={x} cy={y} r="18" fill="transparent" />
              {here && <circle cx={x} cy={y} r="15" fill="none" stroke="#ef3340" strokeWidth="3" className="animate-pulse-soft" />}
              <circle cx={x} cy={y} r={picked ? 11 : 9} fill="#ffffff" stroke="#111111" strokeWidth="3.5" />
              <text x={x} y={labelBelow ? y - 25 : y + 26} fontSize="12" fontWeight="700" fill="#111111" textAnchor="middle">{a.name}</text>
              <text x={x} y={labelBelow ? y - 15 : y + 37} fontSize="8" fill="#52525b" textAnchor="middle">{a.postcode}</text>
              {id === "albion" && <text x={x + 16} y={y + 4} fontSize="12">🏠</text>}
              {id === jobArea && <text x={x - 28} y={y + 4} fontSize="12">💼</text>}
            </g>
          );
        })}
        {/* legend */}
        <g fontSize="8" fill="#3f3f46">
          <line x1="16" y1="380" x2="34" y2="380" stroke="#e1251b" strokeWidth="5" />
          <text x="40" y="383">Albion line</text>
          <line x1="104" y1="380" x2="122" y2="380" stroke="#1c1c1c" strokeWidth="5" />
          <text x="128" y="383">Northern Heights line</text>
          <text x="384" y="383" textAnchor="end">🏠 home · 💼 work</text>
        </g>
      </svg>

      {sel ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 animate-rise">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-xl font-bold">{AREAS[sel].name}</span>
            <span className="text-sm text-white/50">{AREAS[sel].postcode}</span>
          </div>
          <p className="mt-0.5 text-sm text-white/65">{AREAS[sel].tagline}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {placesIn(sel).filter((p) => p.kind !== "station").map((p) => (
              <span key={p.id} className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/75">{p.name}</span>
            ))}
          </div>
          {sel === area ? (
            <div className="mt-3 rounded-xl bg-white/8 py-2.5 text-center text-sm text-white/60">You're here</div>
          ) : (
            <button
              onClick={() => travel(sel, fromStation)}
              disabled={money < fare}
              className="mt-3 w-full rounded-xl bg-brand py-3 font-display font-semibold transition hover:bg-brand-dark disabled:opacity-40"
            >
              {tube ? "Take the Tube" : "Night bus"} · {fmtMoney(fare)} · ~{mins} min
            </button>
          )}
          {!fromStation && sel !== area && <p className="mt-1.5 text-center text-[11px] text-white/45">Includes the walk to the station.</p>}
          {!tube && <p className="mt-1.5 text-center text-[11px] text-white/45">The Tube's shut (00:30–05:30). Night buses are slower.</p>}
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-white/55">Tap a station to see what's there.</p>
      )}
    </div>
  );
}
