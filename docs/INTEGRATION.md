# Bringing Nen World into the Nen Archive

**Can it go into the site? Yes.** The game was built for that from the start:

- the whole simulation runs in the visitor's browser;
- it uses the site's design tokens and Nen colours;
- it speaks the site's data shapes (Original Characters, Ledger abilities, Patreon tiers);
- it costs nothing to run on the server.

## How the site is built (what matters for this)

| Site fact | Consequence for the game |
|---|---|
| Next.js 15 App Router, React 19, TypeScript, Tailwind 4, on Vercel | The game is React 19 + TypeScript. It can mount as a client component or live as a static build beside the site. |
| Firebase Auth, Firestore, Storage; very cost-sensitive (free tier) | The game never writes to Firestore while playing. Worlds live in the browser (IndexedDB, gzip). Only optional cloud saves and the Weekly World touch Firebase, and only on explicit actions. |
| Patreon tiers `free` / `supporter` / `coffee` (`lib/features/patreon/tier-map.ts`), gated as `FEATURES.patreonWebsite && tierAtLeast(tier, X)` | The game has the same three tiers (`TIER_INFLUENCE` in `src/sim/player/player.ts`). The site passes the member's normalised tier in; the game never talks to Patreon itself. |
| Feature flags in `lib/features.ts` (`flag(process.env.NEXT_PUBLIC_FEATURE_…)`) | Add `world: flag(process.env.NEXT_PUBLIC_FEATURE_WORLD, false)` and ship dark. |
| Original Characters (`lib/features/originals/types.ts`) with `realized.nenType` and `abilityRefs`, Phase 4 runs that start at level 1 with Nen locked | `src/integration/archive-adapter.ts` turns an OC into a run character that starts the same way, and a Ledger `AbilityDocument` into a destined Hatsu. Vow star ratings become conditions, using the author's own vow text. |
| 607 character files in `HXH Characters/`, portraits at `/portraits/{id}.png` | `scripts/import-archive.mjs` imports names, Nen types, arcs and ability names (no prose, no portraits). Inside the site, character sheets can show the real portrait and link to `/characters/{id}`. |
| Hex order Enhancer, Transmuter, Conjurer, Specialist, Manipulator, Emitter (`config/nen-hex.ts`) | Identical to the game's `NEN_TYPES`, so type indices pass straight through. |

## Two ways in

### A. Embed (recommended first)

Deploy this repo as its own Vercel project:

- build command `npm run build`, output `dist`;
- domain e.g. `world.nenarchive.com`.

On the site, add one page, `app/world/page.tsx`. It renders the site nav and a full-height `<iframe src="https://world.nenarchive.com">`. When the iframe posts `nen-world:ready`, the page sends:

```ts
frame.contentWindow.postMessage({ type: 'nen-world:tier', tier: tier ?? 'free' }, WORLD_ORIGIN)
// From an OC page: "Play this character in Nen World"
frame.contentWindow.postMessage({ type: 'nen-world:oc', oc, ability }, WORLD_ORIGIN)
```

`src/ui/host.ts` accepts messages only from the Archive's origins, `*.vercel.app` previews and localhost.

- **Pros:** zero coupling, and the game ships on its own schedule. A heavy simulation never slows the site's build.
- **Cons:** two deployments. Character links from the game to the Archive open the site in a new tab.

### B. Source integration (later)

Move `src/sim` and `src/ui` into the site as `lib/features/world/` (or publish them as a workspace package `@nen-archive/world`). Then add `app/world/page.tsx` as a `"use client"` page that loads it with `next/dynamic` and `ssr: false`. The worker comes in with `new Worker(new URL('./sim.worker.ts', import.meta.url))`, which Next supports.

- **Pros:** shared auth state. Portraits and character pages work directly. One deployment.
- **Cons:** the site build grows by about 1 MB of client code on that route only.

Start with **A**. Move to **B** once the game's rules settle.

## Checklist for option A

1. Create a Vercel project from `has-beep/Nen-Archive-Game_TNW`. Framework: Vite. Build: `npm run build`. Output: `dist`.
2. Site: add `NEXT_PUBLIC_FEATURE_WORLD` and `NEXT_PUBLIC_WORLD_ORIGIN` env vars.
3. Site: `app/world/page.tsx`. Behind `FEATURES.world`, render `SiteNav` and the iframe. On `nen-world:ready`, send `nen-world:tier` with the member's normalised tier (the same value the perks code already reads).
4. Site: on the OC page (owner only), add "Play in Nen World". It opens `/world?oc={ocId}`. The world page fetches the OC and its first linked ability, then sends `nen-world:oc`.
5. Site nav: add "World" under the existing interactive sections (beside Explorer and Atlas).
6. Optional, Coffee tier: cloud saves. The game hands the site a gzip blob (`postMessage({type:'nen-world:save'})`, to be added). The site writes it to Firebase Storage at `worlds/{uid}/{slot}.json.gz` (about 0.5–2 MB per save), capped at 3 slots per member. At the free tier's 5 GB that is roughly 1,500 members' slots before any cost.

## Firebase cost

- **Playing:** nothing. No reads, no writes.
- **Weekly World (Coffee):** one small Firestore document per week holds the seed and the list of participating OCs (`ocId`, name, type, ability id). Clients read it once per session. About 50 bytes per OC.
- **Cloud saves (Coffee):** Storage only, written when the player presses Save.

## What the site can show from the game

- **On a canon character's Archive page:** "Follow in Nen World" (deep link), plus their in-world fate in the member's own world (local only).
- **On an OC page:** the OC's life story from a world, exported as text the member can choose to publish to their OC's sections. This uses the existing `sections` field, so nothing new is stored by default.
