import { useEffect, useState } from "react";
import { useGame, dayOf, fmtMoney, fmtTime, WEATHER_LABEL, type Look } from "../state/store";
import { AREAS, BACKGROUNDS, OUTFITS, bodyOf, defaultOutfit, outfitOf, type Background, type Body, type Gender, type HairStyle } from "../state/content";
import { readSave } from "../state/save";
import { audio } from "../game/systems/audio";
import { Icon } from "./Icon";

const SKINS = ["#f3d2c1", "#e0b49a", "#c68a63", "#a8724f", "#8d5a3b", "#5a3a26", "#3d2618"];
const HAIRS = ["#0e0b09", "#3b2416", "#7a4a26", "#c9a15a", "#b5532a", "#9a9a9a", "#e8d9b5"];
const JACKETS = ["#1e3a5f", "#111111", "#7c2d12", "#14532d", "#5b2333", "#c8102e", "#6b4f2a", "#e5e7eb"];
const TROUSERS = ["#22252c", "#1f2a44", "#3a3a3a", "#4a3f35", "#d6c7a1"];
const GENDERS: { id: Gender; label: string }[] = [
  { id: "male", label: "Man" }, { id: "female", label: "Woman" }, { id: "nonbinary", label: "Non-binary" },
];
const STYLES: { id: HairStyle; label: string }[] = [
  { id: "short", label: "Short" }, { id: "long", label: "Long" }, { id: "bun", label: "Bun" },
  { id: "afro", label: "Afro" }, { id: "cap", label: "Cap" }, { id: "bald", label: "Bald" },
];

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
          className={`h-8 w-8 rounded-full border-2 transition ${value === c ? "scale-110 border-white" : "border-white/15 hover:border-white/50"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function TitleScreen() {
  const profile = useGame((s) => s.profile);
  const startGame = useGame((s) => s.startGame);
  const setDraft = useGame((s) => s.setDraftLook);
  const minutes = useGame((s) => s.minutes);
  const weather = useGame((s) => s.weather);
  const continueGame = useGame((s) => s.continueGame);
  const [save] = useState(readSave);
  const [name, setName] = useState(profile.name);
  const [bg, setBg] = useState<Background>(profile.background);
  const [look, setLook] = useState<Look>(profile.look);
  const [step, setStep] = useState<"intro" | "create">("intro");
  const [hairTouched, setHairTouched] = useState(false);
  const set = (patch: Partial<Look>) => setLook((l) => ({ ...l, ...patch }));
  const outfit = outfitOf(look);
  const body = bodyOf(outfit);

  // Show the character being designed on the street behind the form.
  useEffect(() => { setDraft(step === "create" ? look : null); }, [step, look, setDraft]);
  useEffect(() => () => setDraft(null), [setDraft]);

  const startAudio = () => {
    audio.start();
    audio.setVolume(useGame.getState().settings.volume);
  };
  const start = () => {
    startAudio();
    startGame({ name: name.trim() || "You", background: bg, look });
  };
  const resume = () => {
    startAudio();
    continueGame();
  };

  return (
    <div className={`pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-r from-black/70 to-transparent ${step === "create" ? "via-black/5" : "via-black/25"}`}>
      {step === "intro" ? (
        <div className="pointer-events-auto flex h-full flex-col justify-end gap-6 p-6 pb-10 sm:justify-center sm:p-14 animate-fadein">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse-soft" /> East London · {fmtTime(minutes)} · {WEATHER_LABEL[weather]}
            </div>
            <h1 className="font-display text-6xl font-bold leading-[0.9] tracking-tight sm:text-8xl">
              UK <span className="text-brand">LIFE</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-white/75">
              New city. Box room. £185 a week. Get a job, make some mates, and whatever you do — <span className="font-semibold text-white">pay Kev on Sunday.</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {save && (
              <button onClick={resume} className="rounded-2xl bg-brand px-7 py-3 text-left shadow-lg shadow-brand/30 transition hover:bg-brand-dark active:scale-[0.98]">
                <span className="block font-display text-lg font-semibold">Continue</span>
                <span className="block text-xs text-white/75">
                  {save.life.profile?.name} · Day {dayOf(save.life.minutes!)} · {fmtMoney(save.life.money ?? 0)} · {AREAS[save.life.area ?? "albion"].name}
                </span>
              </button>
            )}
            <button
              onClick={() => setStep("create")}
              className={save
                ? "rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-display text-lg font-semibold transition hover:bg-white/10 active:scale-[0.98]"
                : "rounded-2xl bg-brand px-7 py-4 font-display text-lg font-semibold shadow-lg shadow-brand/30 transition hover:bg-brand-dark active:scale-[0.98]"}
            >
              Start a new life
            </button>
            <span className="text-sm text-white/50">
              Free · Plays in your browser · Live London weather by{" "}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white/80">Open-Meteo.com</a>
            </span>
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto flex h-full items-end p-3 sm:items-center sm:p-10">
          <div className="glass max-h-[54vh] w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:max-h-[88vh] sm:p-6 animate-rise">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Who are you?</h2>
              <button onClick={() => setStep("intro")} className="rounded-full p-2 text-white/60 hover:bg-white/10" aria-label="Back"><Icon name="back" /></button>
            </div>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 18))}
              placeholder="Your name"
              className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-white/30"
            />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Gender</label>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => set({
                    gender: g.id,
                    // keep the outfit if it comes in this build; non-binary characters can wear either
                    outfit: g.id === "nonbinary" || bodyOf(outfitOf(look)) === g.id ? outfitOf(look) : defaultOutfit(g.id),
                    ...(hairTouched ? {} : { hairStyle: g.id === "female" ? "long" : "short" }),
                  })}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${look.gender === g.id ? "border-brand bg-brand/15" : "border-white/10 bg-white/5 text-white/75 hover:border-white/25"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Starting out</label>
            <div className="mb-5 grid grid-cols-2 gap-2">
              {(Object.keys(BACKGROUNDS) as Background[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setBg(k)}
                  className={`rounded-2xl border p-3 text-left transition ${bg === k ? "border-brand bg-brand/15" : "border-white/10 bg-white/5 hover:border-white/25"}`}
                >
                  <div className="font-display text-lg font-semibold">{BACKGROUNDS[k].title}</div>
                  <div className="font-display text-sm text-white/80 tabular">£{BACKGROUNDS[k].money.toLocaleString("en-GB")}</div>
                  <div className="mt-1 text-xs leading-snug text-white/55">{BACKGROUNDS[k].blurb}</div>
                </button>
              ))}
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Skin</label>
            <div className="mb-4"><Swatches colors={SKINS} value={look.skin} onChange={(c) => set({ skin: c })} /></div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Hair</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => { setHairTouched(true); set({ hairStyle: s.id }); }} className={`rounded-full px-3 py-1.5 text-sm transition ${look.hairStyle === s.id ? "bg-white text-ink" : "bg-white/8 text-white/75 hover:bg-white/15"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mb-4"><Swatches colors={HAIRS} value={look.hair} onChange={(c) => set({ hair: c })} /></div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Outfit</label>
            {look.gender === "nonbinary" && (
              <div className="mb-2 flex gap-1.5">
                {(["male", "female"] as Body[]).map((b) => (
                  <button key={b} onClick={() => set({ outfit: OUTFITS[b][0].id })} className={`rounded-full px-3 py-1.5 text-sm transition ${body === b ? "bg-white text-ink" : "bg-white/8 text-white/75 hover:bg-white/15"}`}>
                    {b === "male" ? "Straight build" : "Curvy build"}
                  </button>
                ))}
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {OUTFITS[body].map((o) => (
                <button key={o.id} onClick={() => set({ outfit: o.id })} className={`rounded-full px-3 py-1.5 text-sm transition ${outfit === o.id ? "bg-white text-ink" : "bg-white/8 text-white/75 hover:bg-white/15"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Top</label>
            <div className="mb-4"><Swatches colors={JACKETS} value={look.jacket} onChange={(c) => set({ jacket: c })} /></div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Bottoms</label>
            <div className="mb-6"><Swatches colors={TROUSERS} value={look.trousers} onChange={(c) => set({ trousers: c })} /></div>

            <button onClick={start} className="w-full rounded-2xl bg-brand py-4 font-display text-lg font-semibold shadow-lg shadow-brand/30 transition hover:bg-brand-dark active:scale-[0.99]">
              Arrive in London →
            </button>
            {save && <p className="mt-3 text-center text-xs text-amber-200/80">This replaces your saved life as {save.life.profile?.name}.</p>}
            <p className="mt-3 text-center text-xs text-white/45">
              Drag the street to turn your character · In game: WASD walk · Shift run · E interact · P phone
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
