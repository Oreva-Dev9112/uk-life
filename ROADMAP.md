# Roadmap

Planned work, roughly in order. Hours are estimates.

## Next up

- [x] **Save and load**. Your life autosaves in the browser and Continue picks it up again. Local only, no accounts.
- [ ] **Needs with consequences** (~3 h). Right now hunger and hygiene can sit at zero with no effect, and passing out gives you a free night's sleep. Add proper penalties: getting ill, being sent home from work, locals avoiding you.
- [ ] **Tests for the game rules** (~4 h). Unit tests (Vitest) for rent and eviction, shifts and pay, travel and fares, job requirements and relationships.
- [ ] **Continuous integration** (~1 h). A GitHub Action that type-checks, tests and builds every push.
- [ ] **Real phone testing** (~3 h). Check frame rate, touch controls and layout on actual iPhone and Android devices, and tune the automatic resolution scaling.

## Making the world better

- [ ] **Districts that look different from each other** (~4 h). All four districts currently share one street layout, so the same phone box and bus stop appear everywhere. Give each its own street furniture and layout.
- [ ] **Go inside your flat** (~8 h). A small interior you can walk around and later decorate.
- [x] **Better characters**. You, the 12 locals and the passers-by use Quaternius's CC0 models with outfits and animations, dressed for their district.
- [ ] **Better cars** (~3 h). Swap the box-built cars for CC0 models (Kenney's Car Kit), with a proper black cab and red bus.
- [ ] **Better buildings** (~12 h). Terraces and shopfronts with real depth: window frames, sills, cornices, chimneys and rooftops, possibly built from Kenney's CC0 Building Kit.
- [ ] **Greenery and street props** (~3 h). Trees, planters, flowers, benches and bins, so the streets aren't bare.
- [ ] **Restyle the menus** (~5 h). Shop panels, conversations and the phone in the same style as the new HUD.
- [ ] **Pick a finish for the camera** (~2 h). An isometric view, optionally with a pixel-art filter (tried out locally; not decided yet).
- [ ] **Sound** (~3 h). Ambience and music that change by district and time of day.
- [ ] **Snow** (~2 h). The real forecast sometimes says snow; for now it falls as drizzle.
- [ ] **Cache the weather** (~1 h). Open-Meteo's free tier allows fewer than 10,000 calls a day per app. One call per visit is fine for now, but if the game gets busy the forecast should come through a cached Vercel function, so it's a few calls an hour however many people play.

## Plan your character's life

Planning tools in the phone, so the game rewards thinking a few weeks ahead instead of scrambling for rent every Sunday. Everything runs on your own device, with no accounts and nothing sent anywhere.

- [ ] **Budget and expense calculator** (~4 h). A phone app that breaks down where your character's money goes each week — rent, food, travel, fun — so you can see what's draining the account before Kev comes knocking.
- [ ] **Rent versus wages** (~3 h). Compare a job's take-home pay against rent and bills in each district, so moving to Soho becomes a real trade-off. Uses the UK figures the game already runs on, like the National Living Wage and Tube fares.
- [ ] **"What if" paths** (~5 h). Try a choice — a cheaper flat, a better-paid job, putting £20 a week aside — and see a projection of how your character's money plays out over the months ahead.
- [ ] **Life map** (~4 h). A timeline of your character's goals (move out of Kev's, land the City job, hit a savings target) with the steps that get you there.

## More London

- [ ] **New districts** (~5 h each): Westminster, Hyde Park (a park, not a street), Greenwich and Brixton. They already appear on the Tube map as "coming soon".
- [ ] **More social life** (~5 h). Texts from locals, events, and relationships that develop over time.

## Polish

- [ ] **Accessibility and settings** (~3 h). Key remapping, reduced motion, text size and contrast options.
- [ ] **Docs** (~2 h). How the street builder and districts work, so new districts are easy to add.

## Known issues

- Single-player only. Saves live in one browser, so they don't follow you to another device.
- Vehicles and buildings are still built from simple shapes.
- Tested in desktop Chrome and an emulated phone, not on real phones or in Safari.
- Sound has not been checked by ear.
- Day 1 is always a Monday, even though the time and weather follow the real date.

## Not planned for now

- **Online multiplayer** (accounts, shared streets, chat). It would mean storing other people's personal data, which is a bigger commitment than this project is taking on at the moment.
