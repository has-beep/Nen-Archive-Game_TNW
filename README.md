# Nen World

A living Hunter x Hunter world for the [Nen Archive](https://www.nenarchive.com). In the spirit of Dwarf Fortress, it runs itself.

The world starts on 1 December 1998, five weeks before the 287th Hunter Exam. Every canon character is where the story finds them, along with the wider cast from the Archive and a few hundred others. From then on, nothing is scripted. People act on what they want, the rules they keep, the people they love and the grudges they hold. The result is Hunter Exams, Troupe raids, elections, Chimera Ants, wars, plagues, and expeditions to the Dark Continent that sometimes come back.

You can:

- follow anyone;
- guide a few characters, whose crossroads become yours;
- create your own character, or bring one in from the Archive;
- design their Hatsu in the Forge;
- nudge fate with a rumour, a meeting or a whisper.

## Run it

```bash
npm install
npm run dev          # the game at http://localhost:5173
npm test             # simulation, engine, combat and adapter tests
npm run sim -- --seed 7 --days 1300 --imp 4      # read a world's history as text
npm run balance      # canon fight calibration
npm run artifact     # one self-contained HTML file in dist-artifact/
```

## Read more

- [docs/DESIGN.md](docs/DESIGN.md): how the simulation works.
- [docs/CANON_STUDY.md](docs/CANON_STUDY.md): the characters' choices and the mechanisms that reproduce them.
- [docs/INTEGRATION.md](docs/INTEGRATION.md): bringing the game into the Nen Archive site.
- [docs/PATREON_TIERS.md](docs/PATREON_TIERS.md): what each Patreon tier gets, and options for the top tier.

## Canon data

The core cast is written by hand in `src/data/canon-main.ts` and `canon-more.ts`. The wider cast (`src/data/archive-cast.ts`) is generated from the Archive's character files by `npm run import:archive`: names, Nen types, arcs and ability names only.

Hunter x Hunter is © Yoshihiro Togashi. This is a non-commercial fan project.
