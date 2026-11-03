// All the game's data: needs, jobs, places on the high street, and the people you can meet.

export type NeedKey = "hunger" | "energy" | "hygiene" | "fun" | "social";
export type Needs = Record<NeedKey, number>;

export const NEED_KEYS: NeedKey[] = ["hunger", "energy", "hygiene", "fun", "social"];

export const NEED_INFO: Record<NeedKey, { label: string; color: string }> = {
  hunger: { label: "Hunger", color: "#f59e0b" },
  energy: { label: "Energy", color: "#facc15" },
  hygiene: { label: "Hygiene", color: "#22d3ee" },
  fun: { label: "Fun", color: "#f472b6" },
  social: { label: "Social", color: "#a78bfa" },
};

// Points lost per game hour while awake.
export const NEED_DECAY: Needs = { hunger: 4.5, energy: 3.2, hygiene: 2.2, fun: 2.8, social: 2.0 };

// UK National Living Wage (21+) from April 2026.
export const LIVING_WAGE = 12.71;
export const WEEKLY_RENT = 185;

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type Background = "skint" | "rich";
export const BACKGROUNDS: Record<Background, { title: string; blurb: string; money: number }> = {
  skint: { title: "Skint", blurb: "£120 to your name and a suitcase with a broken wheel.", money: 120 },
  rich: { title: "Rich Kid", blurb: "Dad's 'lent' you £2,500. He will mention it at Christmas.", money: 2500 },
};

// ---------- Jobs ----------
export type JobId = "barista" | "fryer" | "bar" | "rider" | "analyst" | "waiter" | "promoter" | "trader";
export interface Job {
  id: JobId;
  title: string;
  employer: string;
  placeId: string | null; // null = work from anywhere (via phone)
  hourly: number;
  start: number; // hour of day
  end: number; // hour of day (24 = midnight)
  blurb: string;
  tips?: [number, number]; // tips range on top of wages
  requires?: { suit?: boolean; shifts?: number };
}

export const JOBS: Record<JobId, Job> = {
  barista: {
    id: "barista", title: "Barista", employer: "Crumbs", placeId: "crumbs",
    hourly: LIVING_WAGE, start: 7, end: 15,
    blurb: "Sausage rolls and flat whites for the morning rush.",
  },
  fryer: {
    id: "fryer", title: "Fryer", employer: "The Codfather", placeId: "chippy",
    hourly: LIVING_WAGE, start: 16, end: 22,
    blurb: "You will smell of vinegar forever. Free chips though.",
  },
  bar: {
    id: "bar", title: "Bar Staff", employer: "The Rose & Crown", placeId: "pub",
    hourly: 13.1, start: 18, end: 24, tips: [5, 25],
    blurb: "Pull pints, dodge Gaz's stories. Tips on a good night.",
  },
  rider: {
    id: "rider", title: "Delivery Rider", employer: "NoshRun", placeId: null,
    hourly: 0, start: 0, end: 24,
    blurb: "Paid per drop, any time, from your phone. Rain means surge pay.",
  },
  analyst: {
    id: "analyst", title: "Junior Analyst", employer: "Crowne & Mills", placeId: "city-bank",
    hourly: 19.5, start: 9, end: 17, requires: { suit: true, shifts: 3 },
    blurb: "Spreadsheets, oat lattes, quiet despair. Needs a suit and some work experience.",
  },
  waiter: {
    id: "waiter", title: "Waiter", employer: "Dragon Gate", placeId: "soho-dragon",
    hourly: LIVING_WAGE, start: 17, end: 23, tips: [8, 30],
    blurb: "Carry six bowls of noodles at once. Good tips on a busy night.",
  },
  promoter: {
    id: "promoter", title: "Club Promoter", employer: "Club Zenith", placeId: "soho-zenith",
    hourly: 14, start: 20, end: 24, tips: [0, 20],
    blurb: "Get people through the door. Charm required, dignity optional.",
  },
  trader: {
    id: "trader", title: "Market Trader", employer: "Camden Lock Market", placeId: "camden-market",
    hourly: LIVING_WAGE, start: 10, end: 18,
    blurb: "Sell vintage sunglasses to tourists who don't need them.",
  },
};

// ---------- Districts and the Tube ----------
export type AreaId = "albion" | "city" | "soho" | "camden";
export interface Area {
  id: AreaId;
  name: string;
  postcode: string;
  tagline: string;
  map: [number, number]; // position on the London map (SVG units)
  station: string; // place id of the area's station
}

export const AREAS: Record<AreaId, Area> = {
  albion: { id: "albion", name: "Albion Park", postcode: "E2", tagline: "Home. Terraces, chippies and Kev.", map: [312, 168], station: "station" },
  city: { id: "city", name: "The City", postcode: "EC2", tagline: "Banks, suits and £6 sandwiches.", map: [232, 214], station: "city-station" },
  soho: { id: "soho", name: "Soho", postcode: "W1", tagline: "Bars, clubs, theatres. Sleep is optional.", map: [128, 220], station: "soho-station" },
  camden: { id: "camden", name: "Camden", postcode: "NW1", tagline: "Markets, gigs and leather jackets.", map: [150, 112], station: "camden-station" },
};

// Stops shown on the map that open in future updates.
export const COMING_SOON: { name: string; map: [number, number] }[] = [
  { name: "Westminster", map: [122, 278] },
  { name: "Hyde Park", map: [52, 236] },
  { name: "Greenwich", map: [340, 312] },
  { name: "Brixton", map: [168, 338] },
];

export const TUBE_LINES: { name: string; color: string; stops: (AreaId | string)[]; soon?: boolean }[] = [
  { name: "Albion line", color: "#e1251b", stops: ["albion", "city", "soho"] },
  { name: "Northern Heights line", color: "#1c1c1c", stops: ["city", "camden"] },
  { name: "Future lines", color: "#a1a1aa", stops: ["soho", "Westminster", "Brixton"], soon: true },
  { name: "Future lines", color: "#a1a1aa", stops: ["soho", "Hyde Park"], soon: true },
  { name: "Future lines", color: "#a1a1aa", stops: ["city", "Greenwich"], soon: true },
];

export const TUBE_FARE = 2.9;
export const NIGHT_BUS_FARE = 1.75;
export const tubeRunning = (hour: number) => hour >= 5.5 || hour < 0.5;
export function travelMinutes(from: AreaId, to: AreaId) {
  const [x1, y1] = AREAS[from].map, [x2, y2] = AREAS[to].map;
  return Math.round(12 + Math.hypot(x2 - x1, y2 - y1) / 6);
}

// ---------- Places ----------
export type Side = "n" | "s";
export type ActionSpecial =
  | "sleep" | "work" | "rent" | "scratchcard" | "tube" | "callMum" | "jobs" | "bus" | "atm" | "suit" | "vintage";

export interface PlaceAction {
  id: string;
  label: string;
  desc?: string;
  price?: number;
  minutes: number;
  needs?: Partial<Needs>;
  fade?: string;
  toast?: string;
  special?: ActionSpecial;
}

export type PlaceKind =
  | "flat" | "bakery" | "chippy" | "shop" | "pub" | "laundrette" | "jobcentre"
  | "gym" | "station" | "phonebox" | "busstop" | "atm"
  | "bank" | "tailor" | "club" | "restaurant" | "bar" | "records" | "theatre" | "market" | "vintage" | "cafe";

export interface Place {
  id: string;
  area: AreaId;
  name: string;
  tagline: string;
  kind: PlaceKind;
  x: number; // centre of the frontage along the street
  side: Side;
  plots: number; // how many 6m building plots it takes (0 = street furniture)
  z?: number; // override interaction z for street furniture
  hours?: [number, number]; // opening hours, close may be > 24
  actions: PlaceAction[];
}

export const PLACES: Place[] = [
  {
    id: "station", area: "albion", name: "Albion Park Station", tagline: "Zone 2. Mind the gap.", kind: "station",
    x: -72, side: "s", plots: 3,
    actions: [
      { id: "tube", label: "Take the Tube", desc: "Pick a destination on the map.", minutes: 0, special: "tube" },
    ],
  },
  {
    id: "flat", area: "albion", name: "27 Albion Road", tagline: "Your box room. Bills included, apparently.", kind: "flat",
    x: -42, side: "n", plots: 1,
    actions: [
      { id: "sleep", label: "Sleep", desc: "Until 7am. Energy refills.", minutes: 0, special: "sleep", fade: "Zzz…" },
      { id: "shower", label: "Shower", desc: "The hot water lasts four minutes.", minutes: 20, needs: { hygiene: 60, energy: 4 }, fade: "Fighting the boiler…" },
      { id: "cook", label: "Beans on toast", desc: "A British classic.", price: 1.2, minutes: 20, needs: { hunger: 30 }, fade: "Cooking…" },
      { id: "telly", label: "Watch telly", desc: "Bake Off repeats.", minutes: 60, needs: { fun: 20, energy: -2 }, fade: "One more episode…" },
      { id: "rent", label: "Pay rent", desc: "£185 to Kev the landlord.", minutes: 0, special: "rent" },
    ],
  },
  {
    id: "crumbs", area: "albion", name: "Crumbs", tagline: "Bakers since last Tuesday.", kind: "bakery",
    x: -18, side: "n", plots: 1, hours: [6, 19],
    actions: [
      { id: "roll", label: "Sausage roll", price: 1.45, minutes: 5, needs: { hunger: 18 }, toast: "Flaky pastry everywhere. Worth it." },
      { id: "coffee", label: "Flat white", price: 3.1, minutes: 10, needs: { energy: 15, fun: 2 }, toast: "Caffeine acquired." },
      { id: "work", label: "Start shift", desc: "Barista, 07:00–15:00", minutes: 0, special: "work" },
    ],
  },
  {
    id: "phonebox", area: "albion", name: "Phone Box", tagline: "Smells of… history.", kind: "phonebox",
    x: -9, side: "n", plots: 0, z: 7.2,
    actions: [
      { id: "mum", label: "Call your mum", desc: "She'll ask if you're eating properly.", price: 0.6, minutes: 15, special: "callMum" },
    ],
  },
  {
    id: "pub", area: "albion", name: "The Rose & Crown", tagline: "Est. 1868. Carpet est. 1868.", kind: "pub",
    x: 27, side: "n", plots: 2, hours: [11, 24],
    actions: [
      { id: "pint", label: "Have a pint", price: 6.4, minutes: 45, needs: { fun: 18, social: 14, energy: -4 }, fade: "Down the pub…" },
      { id: "crisps", label: "Packet of crisps", price: 1.8, minutes: 5, needs: { hunger: 8, fun: 2 } },
      { id: "quiz", label: "Pub quiz", desc: "Your team name: 'Quiz Team Aguilera'.", price: 2, minutes: 90, needs: { fun: 30, social: 22, energy: -6 }, fade: "Question 4: What is the capital of…" },
      { id: "work", label: "Start shift", desc: "Bar staff, 18:00–00:00", minutes: 0, special: "work" },
    ],
  },
  {
    id: "jobcentre", area: "albion", name: "Job Centre", tagline: "Take a ticket. Any ticket.", kind: "jobcentre",
    x: 57, side: "n", plots: 2, hours: [9, 17],
    actions: [
      { id: "jobs", label: "Look for work", desc: "See who's hiring.", minutes: 20, special: "jobs" },
    ],
  },
  {
    id: "chippy", area: "albion", name: "The Codfather", tagline: "An offer you can't refuse.", kind: "chippy",
    x: -30, side: "s", plots: 1, hours: [11, 23],
    actions: [
      { id: "fish", label: "Fish & chips", price: 9.5, minutes: 20, needs: { hunger: 55, fun: 4 }, toast: "Salt. Vinegar. Bliss." },
      { id: "curry", label: "Chips & curry sauce", price: 4.2, minutes: 15, needs: { hunger: 32 } },
      { id: "work", label: "Start shift", desc: "Fryer, 16:00–22:00", minutes: 0, special: "work" },
    ],
  },
  {
    id: "busstop", area: "albion", name: "Bus Stop", tagline: "The 38. Allegedly.", kind: "busstop",
    x: -6, side: "s", plots: 0, z: -7.4,
    actions: [
      { id: "bus", label: "Wait for the 38", minutes: 20, special: "bus" },
    ],
  },
  {
    id: "shop", area: "albion", name: "Kwik Mart", tagline: "Open 24 hours. Mo never sleeps.", kind: "shop",
    x: 6, side: "s", plots: 1,
    actions: [
      { id: "mealdeal", label: "Meal deal", desc: "Sandwich, crisps, drink.", price: 3.85, minutes: 10, needs: { hunger: 35, fun: 3 }, toast: "The finest £3.85 in Britain." },
      { id: "energy", label: "Energy drink", price: 1.89, minutes: 2, needs: { energy: 20, hunger: 2 }, toast: "Your heart is doing a drum solo." },
      { id: "scratch", label: "Scratchcard", desc: "Feeling lucky?", price: 2, minutes: 2, special: "scratchcard" },
      { id: "atm", label: "Check balance", desc: "Free cash withdrawals!", minutes: 1, special: "atm" },
    ],
  },
  {
    id: "laundrette", area: "albion", name: "Spin City", tagline: "Launderette & dry cleaning.", kind: "laundrette",
    x: 36, side: "s", plots: 1, hours: [7, 22],
    actions: [
      { id: "wash", label: "Do your washing", price: 4.5, minutes: 60, needs: { hygiene: 35, fun: -2 }, fade: "Watching your socks go round…" },
    ],
  },
  {
    id: "gym", area: "albion", name: "PureFlex Gym", tagline: "No pain, no monthly fee refunds.", kind: "gym",
    x: 69, side: "s", plots: 2, hours: [6, 23],
    actions: [
      { id: "workout", label: "Work out", desc: "Day pass.", price: 8, minutes: 60, needs: { fun: 15, energy: -15, hygiene: -20, hunger: -8 }, fade: "Leg day…" },
      { id: "showergym", label: "Use the showers", minutes: 15, needs: { hygiene: 45 } },
    ],
  },

  // ---------- The City (EC2) ----------
  {
    id: "city-station", area: "city", name: "Bank Station", tagline: "Zone 1. Everyone's late for something.", kind: "station",
    x: -72, side: "s", plots: 3, actions: [{ id: "tube", label: "Take the Tube", desc: "Pick a destination on the map.", minutes: 0, special: "tube" }],
  },
  {
    id: "city-pronto", area: "city", name: "Pronto", tagline: "Sandwiches with a social conscience. Allegedly.", kind: "cafe",
    x: -42, side: "n", plots: 1, hours: [6, 19],
    actions: [
      { id: "sandwich", label: "Posh sandwich", desc: "Crayfish and rocket.", price: 5.45, minutes: 10, needs: { hunger: 32 }, toast: "Very Square Mile of you." },
      { id: "flatwhite", label: "Oat flat white", price: 3.65, minutes: 10, needs: { energy: 16, fun: 2 } },
    ],
  },
  {
    id: "city-bank", area: "city", name: "Crowne & Mills", tagline: "Private bank. Est. 1792. Suits only.", kind: "bank",
    x: -12, side: "n", plots: 3, hours: [8, 19],
    actions: [
      { id: "work", label: "Start shift", desc: "Junior Analyst, 09:00–17:00", minutes: 0, special: "work" },
      { id: "vacancies", label: "Ask about vacancies", minutes: 10, special: "jobs" },
    ],
  },
  {
    id: "city-tailor", area: "city", name: "Hartley & Sons", tagline: "Tailors to the Square Mile since 1903.", kind: "tailor",
    x: 18, side: "s", plots: 1, hours: [9, 18],
    actions: [{ id: "suit", label: "Buy a suit", desc: "The bank won't hire you without one.", price: 180, minutes: 40, special: "suit", fade: "Arms up… now breathe in…" }],
  },
  {
    id: "city-pub", area: "city", name: "The Counting House", tagline: "Where bonuses go to die.", kind: "pub",
    x: 27, side: "n", plots: 2, hours: [11, 23],
    actions: [
      { id: "pint", label: "After-work pint", price: 7.8, minutes: 45, needs: { fun: 16, social: 16, energy: -4 }, fade: "Down the pub…" },
      { id: "network", label: "Network", desc: "Buy a round. Collect LinkedIn connections.", price: 24, minutes: 90, needs: { social: 30, fun: 10, energy: -8 }, fade: "So, what do you do?" },
    ],
  },
  {
    id: "city-wine", area: "city", name: "Vintner's", tagline: "Small plates, big bills.", kind: "bar",
    x: 48, side: "s", plots: 1, hours: [12, 23],
    actions: [{ id: "wine", label: "Glass of red", price: 11.5, minutes: 40, needs: { fun: 18, social: 10 }, fade: "Notes of blackcurrant and debt…" }],
  },
  {
    id: "city-gym", area: "city", name: "Ironworks", tagline: "Premium fitness. Premium prices.", kind: "gym",
    x: 63, side: "n", plots: 2, hours: [6, 22],
    actions: [
      { id: "workout", label: "Work out", desc: "Day pass.", price: 16, minutes: 60, needs: { fun: 20, energy: -12, hygiene: -15, hunger: -8 }, fade: "Spin class…" },
      { id: "spa", label: "Steam room & shower", price: 10, minutes: 30, needs: { hygiene: 55, fun: 8 }, fade: "Ahh…" },
    ],
  },
  // ---------- Soho (W1) ----------
  {
    id: "soho-station", area: "soho", name: "Soho Circus Station", tagline: "Zone 1. Mind the theatre crowds.", kind: "station",
    x: -72, side: "s", plots: 3, actions: [{ id: "tube", label: "Take the Tube", desc: "Pick a destination on the map.", minutes: 0, special: "tube" }],
  },
  {
    id: "soho-zenith", area: "soho", name: "Club Zenith", tagline: "Queue round the block. Worth it?", kind: "club",
    x: -36, side: "n", plots: 2, hours: [21, 28],
    actions: [
      { id: "dance", label: "Hit the dancefloor", desc: "Entry £15.", price: 15, minutes: 120, needs: { fun: 35, social: 25, energy: -15, hygiene: -10 }, fade: "Untz untz untz…" },
      { id: "work", label: "Start shift", desc: "Promoter, 20:00–00:00", minutes: 0, special: "work" },
    ],
  },
  {
    id: "soho-dragon", area: "soho", name: "Dragon Gate", tagline: "Chinatown's best hand-pulled noodles.", kind: "restaurant",
    x: -6, side: "s", plots: 1, hours: [11, 24],
    actions: [
      { id: "noodles", label: "Hand-pulled noodles", price: 9.8, minutes: 30, needs: { hunger: 48, fun: 5 }, fade: "Slurp…" },
      { id: "work", label: "Start shift", desc: "Waiter, 17:00–23:00", minutes: 0, special: "work" },
    ],
  },
  {
    id: "soho-velvet", area: "soho", name: "The Velvet Room", tagline: "Cocktails, candlelight, questionable jazz.", kind: "bar",
    x: 12, side: "n", plots: 1, hours: [17, 26],
    actions: [{ id: "cocktail", label: "Cocktail", price: 13.5, minutes: 45, needs: { fun: 22, social: 18, energy: -3 }, fade: "Shaken, not stirred…" }],
  },
  {
    id: "soho-records", area: "soho", name: "Groove Records", tagline: "Vinyl, since before it was cool again.", kind: "records",
    x: 36, side: "s", plots: 1, hours: [10, 20],
    actions: [
      { id: "browse", label: "Browse the crates", minutes: 30, needs: { fun: 8 }, fade: "Flick, flick, flick…" },
      { id: "vinyl", label: "Buy a record", price: 24, minutes: 15, needs: { fun: 25 }, toast: "Rare pressing. You'll never play it." },
    ],
  },
  {
    id: "soho-theatre", area: "soho", name: "The Palace Theatre", tagline: "Now showing: Mind the Gap — The Musical.", kind: "theatre",
    x: 57, side: "n", plots: 2, hours: [18, 23],
    actions: [{ id: "show", label: "See the show", price: 39, minutes: 150, needs: { fun: 45, social: 12, energy: -6 }, fade: "♪ Mind the gap, mind the gap… ♪" }],
  },
  // ---------- Camden (NW1) ----------
  {
    id: "camden-station", area: "camden", name: "Camden Town Station", tagline: "Exit only on Sundays. Obviously.", kind: "station",
    x: -72, side: "s", plots: 3, actions: [{ id: "tube", label: "Take the Tube", desc: "Pick a destination on the map.", minutes: 0, special: "tube" }],
  },
  {
    id: "camden-market", area: "camden", name: "Camden Lock Market", tagline: "Street food, vintage, and a man selling incense.", kind: "market",
    x: -33, side: "n", plots: 0, hours: [10, 19],
    actions: [
      { id: "streetfood", label: "Street food", price: 8, minutes: 20, needs: { hunger: 42, fun: 6 }, toast: "Korean fried chicken. No regrets." },
      { id: "browse", label: "Browse the stalls", minutes: 40, needs: { fun: 12 }, fade: "Do you need a hand-carved elephant? No." },
      { id: "work", label: "Start shift", desc: "Market trader, 10:00–18:00", minutes: 0, special: "work" },
    ],
  },
  {
    id: "camden-vintage", area: "camden", name: "Rewind Vintage", tagline: "Pre-loved. Pre-smelled.", kind: "vintage",
    x: 6, side: "s", plots: 1, hours: [10, 19],
    actions: [{ id: "jacket", label: "Buy a vintage jacket", desc: "A new look, instantly.", price: 32, minutes: 25, special: "vintage", fade: "Does it come in… vintage?" }],
  },
  {
    id: "camden-gig", area: "camden", name: "The Electric Room", tagline: "Live music most nights. Sticky floors always.", kind: "club",
    x: 30, side: "n", plots: 2, hours: [19, 24],
    actions: [{ id: "gig", label: "See a gig", price: 16, minutes: 120, needs: { fun: 38, social: 16, energy: -10 }, fade: "One, two, three, four!" }],
  },
  {
    id: "camden-cafe", area: "camden", name: "Lock Café", tagline: "Tea by the canal. Ducks optional.", kind: "cafe",
    x: 54, side: "s", plots: 1, hours: [8, 18],
    actions: [
      { id: "tea", label: "Cup of tea", price: 2.8, minutes: 20, needs: { energy: 6, fun: 5, social: 4 } },
      { id: "cake", label: "Slice of cake", price: 4.2, minutes: 15, needs: { hunger: 18, fun: 6 } },
    ],
  },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id)!;
export const placesIn = (area: AreaId) => PLACES.filter((p) => p.area === area);

export function isOpen(place: Place, hour: number) {
  if (!place.hours) return true;
  const [open, close] = place.hours;
  if (close > 24) return hour >= open || hour < close - 24;
  return hour >= open && hour < close;
}

// ---------- People ----------
export type Topic = "weather" | "banter" | "work" | "pub" | "flirt";

export interface NpcDef {
  id: string;
  area: AreaId;
  name: string;
  age: number;
  role: string;
  intro: string;
  look: { skin: string; hair: string; jacket: string; trousers: string; hairStyle: HairStyle; gender: Gender };
  anchor: [number, number]; // where they hang out
  likes: Record<"weather" | "banter" | "flirt", number>; // -1..1
  workTip: string;
}

export type Gender = "male" | "female" | "nonbinary";
export type HairStyle = "short" | "long" | "bun" | "afro" | "bald" | "cap";

export const NPCS: NpcDef[] = [
  {
    id: "priya", area: "albion", name: "Priya", age: 26, role: "A&E nurse",
    intro: "Priya. I'm a nurse at the Royal London, so if I look dead inside, that's why.",
    look: { skin: "#a8724f", hair: "#1c1410", jacket: "#2f4f6f", trousers: "#1f2430", hairStyle: "long", gender: "female" },
    anchor: [-17, 7.6], likes: { weather: 0.8, banter: -0.2, flirt: 0.2 },
    workTip: "Crumbs is always hiring. They go through baristas like sausage rolls.",
  },
  {
    id: "tunde", area: "albion", name: "Tunde", age: 24, role: "Music producer",
    intro: "Tunde. I make beats. And fix phones. Mostly fix phones.",
    look: { skin: "#5a3a26", hair: "#0e0b09", jacket: "#c2410c", trousers: "#2a2a2a", hairStyle: "afro", gender: "male" },
    anchor: [-31, -7.4], likes: { weather: -0.3, banter: 0.9, flirt: 0.1 },
    workTip: "Codfather needs a fryer. You'll stink, but Uncle Sal pays on time.",
  },
  {
    id: "gaz", area: "albion", name: "Gaz", age: 52, role: "Ex-cabbie, pub regular",
    intro: "Gaz. Drove a cab for thirty years. Know every road in London, me.",
    look: { skin: "#e0b49a", hair: "#9a9a9a", jacket: "#3b3b2f", trousers: "#2b3442", hairStyle: "bald", gender: "male" },
    anchor: [25, 7.8], likes: { weather: 0.9, banter: 0.7, flirt: -0.8 },
    workTip: "The Rose & Crown's after bar staff. Tell 'em Gaz sent you. Actually, don't.",
  },
  {
    id: "chloe", area: "albion", name: "Chloe", age: 21, role: "Art student",
    intro: "Chloe. Art student. My dissertation is about launderettes, don't ask.",
    look: { skin: "#f1c9ad", hair: "#b5532a", jacket: "#5b7a3a", trousers: "#262b3d", hairStyle: "bun", gender: "female" },
    anchor: [37, -7.5], likes: { weather: -0.4, banter: 0.4, flirt: 0.6 },
    workTip: "NoshRun riders make bank when it rains. So, always.",
  },
  {
    id: "mo", area: "albion", name: "Mo", age: 33, role: "Runs Kwik Mart",
    intro: "Mo. This is my shop. Open twenty-four hours. I have not slept since 2019.",
    look: { skin: "#8d5a3b", hair: "#120d0a", jacket: "#14532d", trousers: "#1f2937", hairStyle: "short", gender: "male" },
    anchor: [5, -8.2], likes: { weather: 0.5, banter: 0.5, flirt: -0.5 },
    workTip: "Job Centre up the road, past the pub. Go early, the queue is biblical.",
  },
  {
    id: "siobhan", area: "albion", name: "Siobhan", age: 34, role: "Personal trainer",
    intro: "Siobhan. PT at PureFlex. You look like you skip leg day.",
    look: { skin: "#f3d2c1", hair: "#d8b25a", jacket: "#be185d", trousers: "#111827", hairStyle: "long", gender: "female" },
    anchor: [68, -7.6], likes: { weather: 0.1, banter: 0.8, flirt: 0.3 },
    workTip: "Gym's not hiring, but NoshRun is. Free cardio.",
  },
  {
    id: "marcus", area: "city", name: "Marcus", age: 31, role: "Investment banker",
    intro: "Marcus. I'm in finance. No, I can't explain what I do either.",
    look: { skin: "#e0b49a", hair: "#3b2416", jacket: "#1f2937", trousers: "#1f2937", hairStyle: "short", gender: "male" },
    anchor: [-14, 7.6], likes: { weather: 0.2, banter: 0.6, flirt: 0.1 },
    workTip: "Crowne & Mills hire juniors, but turn up in a suit. Hartley & Sons, over the road.",
  },
  {
    id: "ingrid", area: "city", name: "Ingrid", age: 44, role: "HR director",
    intro: "Ingrid, HR. I've seen your type. Mostly in disciplinaries.",
    look: { skin: "#f3d2c1", hair: "#c9a15a", jacket: "#5b2333", trousers: "#111827", hairStyle: "bun", gender: "female" },
    anchor: [29, 7.8], likes: { weather: 0.6, banter: -0.1, flirt: -0.5 },
    workTip: "We look for three things: experience, a suit, and not crying in the lift.",
  },
  {
    id: "jules", area: "soho", name: "Jules", age: 27, role: "Club promoter",
    intro: "Jules. I run the door at Zenith. You're not on the list. Yet.",
    look: { skin: "#8d5a3b", hair: "#120d0a", jacket: "#6b21a8", trousers: "#111111", hairStyle: "cap", gender: "nonbinary" },
    anchor: [-34, 7.6], likes: { weather: -0.4, banter: 0.9, flirt: 0.5 },
    workTip: "Zenith always needs promoters. Pay's alright, nights are long.",
  },
  {
    id: "mei", area: "soho", name: "Mei", age: 29, role: "Chef at Dragon Gate",
    intro: "Mei. I make the noodles. By hand. Every single one.",
    look: { skin: "#f1d1b5", hair: "#0e0b09", jacket: "#f3f4f6", trousers: "#1f2937", hairStyle: "bun", gender: "female" },
    anchor: [-6, -7.6], likes: { weather: 0.2, banter: 0.5, flirt: 0.2 },
    workTip: "We need a waiter for the evening shift. Fast feet, good memory.",
  },
  {
    id: "rafa", area: "camden", name: "Rafa", age: 23, role: "Busker",
    intro: "Rafa. Guitar, voice, questionable hat. Tips appreciated.",
    look: { skin: "#c68a63", hair: "#3b2416", jacket: "#7c2d12", trousers: "#1f2a44", hairStyle: "long", gender: "male" },
    anchor: [-14, 7.4], likes: { weather: -0.2, banter: 0.7, flirt: 0.4 },
    workTip: "The market always needs hands on a Saturday. And a Tuesday. Always.",
  },
  {
    id: "nia", area: "camden", name: "Nia", age: 35, role: "Runs a vintage stall",
    intro: "Nia. That jacket? Mine. Everything here is mine. It's a stall.",
    look: { skin: "#5a3a26", hair: "#0e0b09", jacket: "#14532d", trousers: "#4a3f35", hairStyle: "afro", gender: "female" },
    anchor: [-30, 8.8], likes: { weather: 0.4, banter: 0.6, flirt: 0.1 },
    workTip: "Ask at the market. Ten till six. Bring a jumper, it's always cold.",
  },
];

export const npcById = (id: string) => NPCS.find((n) => n.id === id)!;

export function relationshipTier(v: number) {
  if (v < 0) return "Not a fan";
  if (v < 20) return "Just met";
  if (v < 50) return "Acquaintance";
  if (v < 80) return "Mate";
  return "Best mate";
}

export const LINES = {
  weatherGood: [
    "Grim out, innit? Third day straight.",
    "Apparently it's sunny in Leeds. Lies.",
    "I've forgotten what the sun looks like, honestly.",
    "My umbrella's turned inside out twice today. Twice!",
  ],
  weatherBad: ["Yeah. Weather. Riveting.", "Is that all you've got? The weather?"],
  banterGood: [
    "Ha! You're alright, you.",
    "Stop it, I'm crying. Actually crying.",
    "Okay that was decent. Don't let it go to your head.",
  ],
  banterBad: ["…Right. Okay then.", "Did you rehearse that? Don't.", "Tumbleweed. Actual tumbleweed."],
  flirtGood: ["Oh, smooth. Very smooth.", "Are you always this charming or is it the rain?", "Hm. You can buy me a coffee sometime."],
  flirtBad: ["Mate. No.", "That's… a lot. Let's go back to the weather.", "I'm going to pretend you didn't say that."],
  repeat: ["We literally just talked about this.", "You've said that already, babe.", "Déjà vu much?"],
  pubYes: ["Go on then. You're buying.", "Twist my arm. Rose & Crown?", "Thought you'd never ask."],
  pubNo: ["Bit soon for that, no?", "Not tonight, I'm shattered.", "Maybe when I know you better."],
  smelly: ["(They take a subtle step back. You might need a shower.)"],
};
