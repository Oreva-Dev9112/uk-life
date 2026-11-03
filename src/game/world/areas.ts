// How each district looks: street style, which builder makes each landmark, shopfront signs and decor.
import type { AreaId, Side } from "../../state/content";

export interface ShopSpec {
  name: string;
  sub?: string;
  kind: string; // interior texture + light colour
  bg: string;
  fg: string;
  hours: [number, number];
  awning?: [string, string];
  neon?: boolean;
  pole?: boolean;
  placeId?: string;
}

export type Landmark =
  | { kind: "station"; name: string }
  | { kind: "flat" }
  | { kind: "jobcentre" }
  | { kind: "pub"; name: string; sub: string; paint: string; gold: string; hangingSign: boolean }
  | { kind: "gym"; name: string; sub: string; neon: string }
  | { kind: "tower"; name: string; sub: string; floors: number }
  | { kind: "club"; name: string; sub: string; neon: string; hours: [number, number] }
  | { kind: "theatre"; name: string; show: string }
  | { kind: "market" };

export interface AreaVisual {
  style: "terrace" | "city" | "soho" | "market";
  landmarks: Record<string, Landmark>; // keyed by place id
  shops: Record<string, ShopSpec>; // places that use a normal shopfront
  decor: (ShopSpec & { x: number; side: Side })[]; // fixed non-interactive shopfronts
  fillerShops: ShopSpec[]; // random ground-floor businesses for this kind of street
  backRow: [number, number]; // height range of the buildings behind the street
  clear?: [number, number, Side][]; // pavement stretches kept free of trees/bins
  pedestrians: number;
  traffic: { buses: number; cabs: number; cars: number };
}

const NO_FILLER: ShopSpec[] = [];

export const AREA_VISUALS: Record<AreaId, AreaVisual> = {
  albion: {
    style: "terrace",
    landmarks: {
      station: { kind: "station", name: "ALBION PARK" },
      flat: { kind: "flat" },
      jobcentre: { kind: "jobcentre" },
      pub: { kind: "pub", name: "THE ROSE & CROWN", sub: "Free House · Est. 1868", paint: "#0f3d2e", gold: "#e5c158", hangingSign: true },
      gym: { kind: "gym", name: "PUREFLEX", sub: "GYM · OPEN LATE", neon: "#ff4fd8" },
    },
    shops: {
      crumbs: { name: "CRUMBS", sub: "The Bakers", kind: "bakery", bg: "#0b2a5b", fg: "#fbd34d", hours: [6, 19], awning: ["#0b2a5b", "#f1f5f9"], placeId: "crumbs" },
      chippy: { name: "THE CODFATHER", sub: "Traditional Fish & Chips", kind: "chippy", bg: "#0e4d92", fg: "#ffffff", hours: [11, 23], placeId: "chippy" },
      shop: { name: "KWIK MART", sub: "Open 24 Hours · Groceries · Off Licence", kind: "shop", bg: "#15803d", fg: "#ffffff", hours: [0, 24], placeId: "shop" },
      laundrette: { name: "SPIN CITY", sub: "Launderette & Dry Cleaning", kind: "laundrette", bg: "#0284c7", fg: "#ffffff", hours: [7, 22], placeId: "laundrette" },
    },
    decor: [
      { x: -66, side: "n", name: "MAGPIE", sub: "Lettings & Estate Agents", kind: "generic", bg: "#151515", fg: "#f5a623", hours: [9, 18] },
      { x: -54, side: "n", name: "CLOUD 9 VAPES", kind: "vape", bg: "#120a1f", fg: "#d8b4fe", hours: [9, 22], neon: true },
      { x: -6, side: "n", name: "PHONE FIX", sub: "Unlocking · Repairs · Cases", kind: "generic", bg: "#0b3a5a", fg: "#ffffff", hours: [9, 20] },
      { x: 6, side: "n", name: "PERI PERI PALACE", sub: "Chicken · Burgers · Wraps", kind: "generic", bg: "#b91c1c", fg: "#fde047", hours: [11, 26] },
      { x: 42, side: "n", name: "SAVE THE STRAYS", sub: "Charity Shop", kind: "generic", bg: "#ece6d6", fg: "#14532d", hours: [9, 17] },
      { x: 72, side: "n", name: "NAILS & BEAUTY", kind: "barber", bg: "#fce7f3", fg: "#be185d", hours: [10, 19] },
      { x: 84, side: "n", name: "TO LET", sub: "Commercial unit available", kind: "empty", bg: "#e5e7eb", fg: "#b91c1c", hours: [0, 0] },
      { x: -54, side: "s", name: "FADEZ", sub: "Barbers · Walk-ins welcome", kind: "barber", bg: "#111827", fg: "#f8fafc", hours: [9, 20], pole: true },
      { x: -42, side: "s", name: "LUCKY STAR BETS", kind: "bookies", bg: "#065f46", fg: "#fef08a", hours: [8, 22] },
      { x: -18, side: "s", name: "BOMBAY SPICE", sub: "Indian Restaurant & Takeaway", kind: "pub", bg: "#7c2d12", fg: "#fcd34d", hours: [17, 23] },
      { x: 18, side: "s", name: "GRIND HOUSE", sub: "Coffee · Brunch", kind: "bakery", bg: "#1c1917", fg: "#e7e5e4", hours: [7, 17], awning: ["#1c1917", "#e7e5e4"] },
      { x: 48, side: "s", name: "ISTANBUL GRILL", kind: "generic", bg: "#1e3a8a", fg: "#fde68a", hours: [11, 27] },
      { x: 84, side: "s", name: "OFF LICENCE", sub: "Wines · Beers · Spirits", kind: "shop", bg: "#14213d", fg: "#fca311", hours: [8, 24] },
    ],
    fillerShops: NO_FILLER,
    backRow: [7, 21],
    pedestrians: 16,
    traffic: { buses: 2, cabs: 3, cars: 5 },
  },

  city: {
    style: "city",
    landmarks: {
      "city-station": { kind: "station", name: "BANK" },
      "city-bank": { kind: "tower", name: "CROWNE & MILLS", sub: "PRIVATE BANK · EST. 1792", floors: 11 },
      "city-pub": { kind: "pub", name: "THE COUNTING HOUSE", sub: "Ales · Wines · Bad decisions", paint: "#14151a", gold: "#d4af37", hangingSign: false },
      "city-gym": { kind: "gym", name: "IRONWORKS", sub: "PREMIUM FITNESS", neon: "#38bdf8" },
    },
    shops: {
      "city-pronto": { name: "PRONTO", sub: "Freshly made sandwiches", kind: "bakery", bg: "#7a1424", fg: "#f8f1e4", hours: [6, 19], placeId: "city-pronto" },
      "city-tailor": { name: "HARTLEY & SONS", sub: "Bespoke Tailors · Est. 1903", kind: "tailor", bg: "#1b2a22", fg: "#e8d9a8", hours: [9, 18], placeId: "city-tailor" },
      "city-wine": { name: "VINTNER'S", sub: "Wine Bar & Kitchen", kind: "bar", bg: "#3b0d1c", fg: "#f3d9b1", hours: [12, 23], placeId: "city-wine" },
    },
    decor: [
      { x: -54, side: "s", name: "SUSHI & CO", sub: "Grab & go", kind: "generic", bg: "#111111", fg: "#f43f5e", hours: [7, 20] },
      { x: -30, side: "s", name: "BUREAU DE CHANGE", sub: "No commission*", kind: "bank", bg: "#0f2f5c", fg: "#fcd34d", hours: [8, 20] },
      { x: 30, side: "s", name: "THE ROYAL CAFÉ", sub: "Breakfast · Lunch", kind: "bakery", bg: "#14532d", fg: "#fef3c7", hours: [6, 16] },
    ],
    fillerShops: NO_FILLER,
    backRow: [24, 70],
    pedestrians: 18,
    traffic: { buses: 2, cabs: 6, cars: 3 },
  },

  soho: {
    style: "soho",
    landmarks: {
      "soho-station": { kind: "station", name: "SOHO CIRCUS" },
      "soho-zenith": { kind: "club", name: "ZENITH", sub: "CLUB · LATE", neon: "#e879f9", hours: [21, 28] },
      "soho-theatre": { kind: "theatre", name: "THE PALACE", show: "MIND THE GAP · THE MUSICAL" },
    },
    shops: {
      "soho-dragon": { name: "DRAGON GATE", sub: "Hand-pulled noodles", kind: "restaurant", bg: "#991b1b", fg: "#fde68a", hours: [11, 24], neon: true, placeId: "soho-dragon" },
      "soho-velvet": { name: "THE VELVET ROOM", sub: "Cocktails", kind: "bar", bg: "#2e1065", fg: "#f0abfc", hours: [17, 26], neon: true, placeId: "soho-velvet" },
      "soho-records": { name: "GROOVE RECORDS", sub: "New · Used · Rare", kind: "records", bg: "#111111", fg: "#fbbf24", hours: [10, 20], placeId: "soho-records" },
    },
    decor: [],
    fillerShops: [
      { name: "BAR MILANO", sub: "Espresso · Late", kind: "bar", bg: "#111111", fg: "#ef4444", hours: [7, 27], neon: true },
      { name: "SUSHI KOBO", kind: "restaurant", bg: "#0f172a", fg: "#f9a8d4", hours: [12, 23], neon: true },
      { name: "TACO LOCO", kind: "restaurant", bg: "#c2410c", fg: "#fef08a", hours: [12, 24] },
      { name: "THE COMEDY CELLAR", sub: "Stand-up nightly", kind: "bar", bg: "#1f2937", fg: "#facc15", hours: [19, 25], neon: true },
      { name: "BAO HOUSE", kind: "restaurant", bg: "#f5f5f4", fg: "#b91c1c", hours: [12, 23] },
      { name: "PIZZA SLICE", sub: "By the slice · Till late", kind: "restaurant", bg: "#991b1b", fg: "#ffffff", hours: [11, 28] },
      { name: "INK & NEEDLE", sub: "Tattoo studio", kind: "barber", bg: "#000000", fg: "#22d3ee", hours: [12, 22], neon: true },
      { name: "LUCKY CAT KARAOKE", kind: "bar", bg: "#701a75", fg: "#fde047", hours: [18, 28], neon: true },
      { name: "WARDOUR VINTAGE", kind: "vintage", bg: "#365314", fg: "#ecfccb", hours: [11, 19] },
      { name: "HOSTEL SOHO", sub: "Beds from £35", kind: "generic", bg: "#1e40af", fg: "#ffffff", hours: [0, 24] },
    ],
    backRow: [12, 24],
    pedestrians: 22,
    traffic: { buses: 1, cabs: 4, cars: 2 },
  },

  camden: {
    style: "market",
    landmarks: {
      "camden-station": { kind: "station", name: "CAMDEN TOWN" },
      "camden-market": { kind: "market" },
      "camden-gig": { kind: "club", name: "THE ELECTRIC ROOM", sub: "LIVE MUSIC", neon: "#22d3ee", hours: [19, 24] },
    },
    shops: {
      "camden-vintage": { name: "REWIND VINTAGE", sub: "Clothing by the kilo", kind: "vintage", bg: "#7c3aed", fg: "#fef08a", hours: [10, 19], placeId: "camden-vintage" },
      "camden-cafe": { name: "LOCK CAFÉ", sub: "Tea · Cake · Canal views", kind: "bakery", bg: "#0e7490", fg: "#ecfeff", hours: [8, 18], awning: ["#0e7490", "#f0fdfa"], placeId: "camden-cafe" },
    },
    decor: [],
    fillerShops: [
      { name: "BOOTS & BUCKLES", kind: "vintage", bg: "#111111", fg: "#facc15", hours: [10, 19] },
      { name: "PUNK RECORDS", kind: "records", bg: "#be123c", fg: "#ffffff", hours: [10, 20] },
      { name: "INCENSE & CO", kind: "generic", bg: "#581c87", fg: "#fbcfe8", hours: [10, 19] },
      { name: "CHURROS!", kind: "bakery", bg: "#f59e0b", fg: "#7c2d12", hours: [10, 21] },
      { name: "VEGAN BITES", kind: "restaurant", bg: "#15803d", fg: "#f0fdf4", hours: [11, 21] },
      { name: "SKATE SHACK", kind: "generic", bg: "#0f172a", fg: "#22d3ee", hours: [10, 19] },
      { name: "TATTOO PARLOUR", kind: "barber", bg: "#000000", fg: "#f43f5e", hours: [11, 20], neon: true },
      { name: "NEON RAVE", sub: "Festival wear", kind: "club", bg: "#020617", fg: "#4ade80", hours: [10, 22], neon: true },
      { name: "SILVER & BEADS", kind: "generic", bg: "#e5e7eb", fg: "#1f2937", hours: [10, 19] },
    ],
    backRow: [7, 13],
    clear: [[-42, -24, "n"]],
    pedestrians: 20,
    traffic: { buses: 1, cabs: 2, cars: 4 },
  },
};
