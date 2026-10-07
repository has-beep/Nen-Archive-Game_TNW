# Nen World: how it works

A living Hunter x Hunter world in the spirit of Dwarf Fortress. Everything is a simulation of people with wants, rules and bonds; the chronicle is what happened to them. The player follows anyone, guides a few, and nudges fate a little.

## Architecture

```
src/sim/          the simulation: pure TypeScript, deterministic, no DOM
  worldgen/       building a world: nations, places, orgs, the canon cast, the archive cast, filler people
  people/         a person's needs, decisions, dreams, relationships, romance, knowledge, health
  nen/            awakening, training, techniques, Hatsu generation, vows
  combat/         the fight engine and what a fight leaves behind
  society/        orgs and their rules, the Exam, Greed Island, Heavens Arena, nations and wars,
                  the Chimera Ants, disasters and hazards, Dark Continent expeditions, economy, travel
  events/         death, encounters between people who mean each other harm
  story/          storylines and how hot each one is
  player/         influence, crossroads, the Forge, character creation
  api/            views (serialisable snapshots) and the engine facade the interface talks to
src/worker/       the Web Worker that hosts the engine
src/ui/           React interface: map, panels, modals; falls back to the main thread without workers
src/integration/  the Nen Archive adapter (Original Characters, Ledger abilities)
src/data/         canon, places, nations, orgs, weapons, hazards, the Dark Continent, the imported cast
scripts/          headless runner, combat balance harness, archive importer, browser smoke test, artifact build
tests/            determinism, save/load, multi-year invariants, the engine facade, canon fights
```

**Deterministic.** One seeded sfc32 stream, held in the world and advanced by reference. The same seed and the same player actions give the same history, which is what makes shared Weekly Worlds possible. Nothing under `src/sim` may call `Math.random` or read the clock.

**Serialisable.** The world is plain JSON. Indices (who is where, key lookups, bond lists) live in WeakMaps and rebuild after a load.

**Level of detail.** People in the focus think daily. Everyone else commits to what they are doing for longer and settles needs every other day. Relationships decay in monthly batches. A year runs in about 3.5 to 5 seconds in a worker.

## A day

1. Calendar (the Exam, the auction, Battera's selection, birthdays, old age).
2. Calamities (the Chimera Ants).
3. Weekly: nations, organisations, storylines, contracts.
4. The election, wars, natural disasters, hazards, expeditions.
5. Every person, in shuffled order: arrive, body (wounds, bleeding, illness, cures), needs, births, think if due, do the day's activity.
6. Every occupied place: people notice each other, strangers meet, teachers find students, romance.
7. Heavens Arena, Greed Island, encounters between hunters and their targets, the player's daily influence.

## People

- **Personality:** 18 facets.
- **Values:** 12 values with a sign (family, law, freedom, strength…).
- **Needs:** 14 needs that decay and are met by activities, weighted by personality.
- **Mood:** happy, stress, fear, anger, grief.
- **Memories** that fade.
- **Dreams** with priority and progress: become a Hunter, find someone, avenge, recover, beat someone, protect, rule, explore, clear Greed Island, master Nen…
- **Duties** to organisations, and **plans** (hunt, go, exam).

**Deciding.** A utility choice over options from needs, dreams, duties, contracts and plans, with noise. Whispers from the player tilt one choice if the person already leans that way.

**Relationships.**

- Each relationship holds affection, trust, respect, fear, attraction, familiarity, debt, and a bitmask of mutual bonds: friend, best friend, lover, spouse, rival, sworn enemy, mentor, student, family, master, servant…
- Bonds come from shared time, fights, rescues and betrayals.
- Kin and formal hierarchies never become "best friends".

**Knowledge.** Facts (crimes, abilities, memberships, secrets, rumours) are learned by witnessing, investigating and gossip. Secrets pass only between people who trust each other. People act on what they know: where someone was last seen, who killed whom, what an ability does.

## Nen

- **Awakening.** Slow, by meditation under a teacher; forced; traumatic; or innate.
- **Techniques.** Ten, Zetsu, Ren, Hatsu, Gyo, Shu, In, En, Ken, Ko and Ryu, each with a level requirement.
- **Categories.** Proficiency per category, capped by the 80/60/40 efficiency of the user's type.
- **Hatsu.** Generated from the user's type, personality and grudges, or destined for canon characters, or designed by the player in the Forge. Each has categories, effects, conditions with stars, and a quality.
- **Vows and conditions.** These buy power; a vow staked on a fight kills the loser.

## Combat

- **Exchanges.** Fights are two-second exchanges on a 40×24 arena, with positions, ranges and initiative.
- **Stances.** Ten, Ren, Ken, Ko, Zetsu or In. Ryu splits aura between offence and defence. Gyo is used against hidden tricks.
- **Damage.** Damage is attack² ÷ (attack + defence). Aura power is the square root of aura output.
- **Health.** Health includes aura armour, which Zetsu strips.
- **Wounds.** Wounds are per body part and can escalate to severed limbs.
- **Hatsu in a fight.** Every effect kind is modelled: binds that weaken with repetition, mind control as an aura contest, seals, transformations, summons, bombs that need explaining, debts, theft, absorption, and charges that a hard hit breaks.
- **Morale.** Fighters flee, yield, or fight on; the Zoldyck rule and Illumi's needle live here.
- **Recording.** Big fights are recorded blow by blow for the replay.
- **Calibration.** `npm run balance` runs 24 canon match-ups and checks the win rates against the story.

## Society

- **Organisations** have rules that are enforced and logged:
  - the Hunter Bylaws;
  - the Troupe's coin toss and vendettas;
  - the Zoldyck contract rule;
  - Mafia bounties;
  - the arena's floors.
- **Nations** have economies, stability, rulers, opinions of each other, militaries (troops, armour, air, navy) and arsenals (missiles, bio-weapons, Poor Man's Roses). Wars are declared with allies and fought on fronts.
- **The V5 become the V6** when Kakin forces the issue.

## Hazards and disasters

- **Hazards.** A place can carry several: fire, flood, rubble, storm, cold, drought, ash, plague, poison, radiation, miasma, ants, Rose fallout, frenzy, living gas, blight, beasts, vanishings.
  - Each hurts the people in it, with aura resisting some kinds and not others.
  - Each leaves conditions (burns, frostbite, radiation sickness, plague, Zobae) and kills part of the population.
  - Each drains wealth and stability, spreads to neighbours or rides along with travellers, and fades faster when helpers come.
- **Natural disasters.** These arrive by geography: earthquakes near mountains, tsunamis and typhoons at ports, blizzards in the north, epidemics in crowded cities.

## The Dark Continent

- **Calamities.** Five recorded calamities, each with its hope (Pap, Brion, Hellbell, Ai, Zobae), plus three to five unrecorded ones rolled per world. Knowledge of them is a state secret.
- **Who goes.** Expeditions are organised by explorers, the greedy, the desperate (a loved one dying of something only the Herb for All Illnesses can cure), rogue nations, and the Association once the V6 open the way.
- **Stages.**
  1. Gather at a port.
  2. Cross past patrols, storms and the Gatekeeper of the New World.
  3. Walk inland week by week.
  4. Meet what lives there.
  5. Search for the hope.
  6. Come home, if anyone can.
- **Outcomes:**
  - treasures that change nations;
  - turning back halfway;
  - capture by the V5;
  - ships that never arrive;
  - castaways who walk out of the sea years later;
  - calamities that come home unnoticed and break out in the port.

## The player

- **Follow** anyone, and **guide** some characters (by tier). A guided character's crossroads (grief, vows, invitations, a Hatsu ready to be born) wait for the player and pause the world.
- **Create** an Original Character, or bring one from the Archive.
- **Influence** buys nudges: rumours, meetings, whispers, gifts, bounties, sending your character somewhere.
- **Nothing is commanded.** People refuse what goes against who they are.

## Testing

- `npm test`: determinism, save/load, three-year runs on three seeds with invariants, the engine facade, canon fights, the Archive adapter.
- `npm run sim -- --seed 7 --days 1300 --imp 4`: the chronicle as plain text, with a death census.
- `npm run balance`: the combat calibration.
- `npm run smoke`: the single-file build in headless Chromium.
