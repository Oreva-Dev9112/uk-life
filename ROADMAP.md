# Roadmap

Planned work, roughly in order. Hours are estimates.

## Next up

- [ ] **Save and load** (~4 h). Keep progress in the browser so a refresh doesn't wipe your life. Local only, no accounts.
- [ ] **Needs with consequences** (~3 h). Right now hunger and hygiene can sit at zero with no effect, and passing out gives you a free night's sleep. Add proper penalties: getting ill, being sent home from work, locals avoiding you.
- [ ] **Tests for the game rules** (~4 h). Unit tests (Vitest) for rent and eviction, shifts and pay, travel and fares, job requirements and relationships.
- [ ] **Continuous integration** (~1 h). A GitHub Action that type-checks, tests and builds every push.
- [ ] **Real phone testing** (~3 h). Check frame rate, touch controls and layout on actual iPhone and Android devices, and tune the automatic resolution scaling.

## Making the world better

- [ ] **Districts that look different from each other** (~4 h). All four districts currently share one street layout, so the same phone box and bus stop appear everywhere. Give each its own street furniture and layout.
- [ ] **Go inside your flat** (~8 h). A small interior you can walk around and later decorate.
- [ ] **Better characters** (~8 h). Replace the shape-built people with proper models and animations under an open licence (for example CC0).
- [ ] **Sound** (~3 h). Ambience and music that change by district and time of day.

## More London

- [ ] **New districts** (~5 h each): Westminster, Hyde Park (a park, not a street), Greenwich and Brixton. They already appear on the Tube map as "coming soon".
- [ ] **More social life** (~5 h). Texts from locals, events, and relationships that develop over time.

## Polish

- [ ] **Accessibility and settings** (~3 h). Key remapping, reduced motion, text size and contrast options.
- [ ] **Docs** (~2 h). How the street builder and districts work, so new districts are easy to add.

## Known issues

- Single-player only, and nothing is saved yet.
- Characters and vehicles are simple placeholder shapes.
- Tested in desktop Chrome and an emulated phone, not on real phones or in Safari.
- Sound has not been checked by ear.

## Not planned for now

- **Online multiplayer** (accounts, shared streets, chat). It would mean storing other people's personal data, which is a bigger commitment than this project is taking on at the moment.
