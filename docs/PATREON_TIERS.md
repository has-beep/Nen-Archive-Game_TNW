# Nen World on Patreon

The Archive has three tiers: **Free** (£0), **Supporter** (£3/mo) and **Buy me a coffee!** (£5/mo, the `UNLOCK_TIER`).

Nen World follows one rule for paid perks: **pay for more ways to play, never for a stronger outcome inside a shared world.** A patron gets more characters, more designing, more worlds, more history kept. They never get a sword that only patrons can swing, because the world's fairness is what makes its stories worth reading.

## What exists in the game today

These are already enforced in `src/sim/player/player.ts` and `src/sim/player/create.ts`.

| | Free | Supporter | Coffee |
|---|---|---|---|
| Characters you guide at once | 1 | 2 | 10 |
| Hatsu you design in the Forge, per character | 1 | 1 | 3 |
| Influence (nudges: rumours, meetings, whispers) | 0.5/day, cap 20 | 0.75/day, cap 40 | 1.25/day, cap 100 |
| Whispers held at once | 1 | 2 | 4 |
| Original Character starts | Ordinary or gifted talent, Nen locked | same | Prodigy talent, or a pre-awakened start |

These line up with the site's own caps (`characterSlots 3/10`, `hatsuSlots 1/3`, `runSlotsPerCharacter 1/10`): a Coffee member can run each of their characters through up to ten worlds.

## Options for the top tier (Coffee)

Ranked by how much they are worth to a member against what they cost the site.

1. **Weekly World.** Every Monday a shared seed is published, and every Coffee member's chosen OC is placed into the same world. Because the simulation is deterministic, each member watches the *same* world from their own seat. Members compare notes on Discord ("did Hisoka find your character?") and see who is still alive on Sunday. Influence is turned off in the Weekly World, so nothing is pay-to-win.
   - Cost: one small Firestore document per week.
2. **Cloud saves.** Three save slots in Firebase Storage, so a world started on the phone continues on the laptop. Free and Supporter members keep browser saves.
   - Cost: Storage only; see `INTEGRATION.md`.
3. **Scenario Lab.** Start in other eras:
   - Netero in his prime (1950s)
   - the Hunter Exam of 1987 with Ging in it
   - the morning after the Chairman Election
   - the Black Whale's landing

   Or set the world's rules: no plot armour, no Chimera Ants, double disasters, an early Dark Continent rush. The engine already has the switches (`Laws`, world options); this tier gets the screen for them.
4. **Legends Book.** Turn a character's life (the chronicle, cause chains, fights) into a formatted book page on the Archive. It is published under the OC's sections, shareable, and printable from the site. The text exists already; this is a view and a publish button.
5. **Expedition patron.** Once per world, sponsor an expedition to the Dark Continent with your character as leader. It is still subject to every risk: patrols, the Gatekeeper, the calamities. Costs influence, not money.
6. **Watch alerts.** When a character on your watch list reaches a crossroads, or dies, you get a ping through the existing Discord role sync (`discordRoleSync` flag) or the site's notifications. This needs the cloud-saved Weekly World or a tab left open, so it pairs with 1 or 2.
7. **Early arcs.** New eras, calamities and Dark Continent regions land for Coffee members a month before everyone else.
8. **Cosmetic credit.** The member's name on an unrecorded calamity or Dark Continent region in that week's Weekly World ("the Glass Steppe, named by …").

## Supporter (£3)

The middle tier gets what makes a single world richer, without the shared-world features:

- 2 characters;
- faster influence;
- the full Legends archive of past worlds in the browser;
- seeds that can be shared by link ("play my world").

## Free

Free members get the whole simulation, every canon character to follow, one character of their own, and browser saves. A Free member should finish a session wanting more worlds, not feeling locked out of this one.

## Gating in code

The site already normalises Patreon tier ids to `free | supporter | coffee` and gates as `FEATURES.patreonWebsite && tierAtLeast(tier, 'coffee')`. Pass that string into the game (`nen-world:tier`). Shared features (Weekly World, cloud saves) are checked again on the site side, because those are the ones that touch Firebase.
