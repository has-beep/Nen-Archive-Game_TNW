/**
 * Heavens Arena: a 251-floor tower where fighters climb by winning.
 *
 * Below the 200th floor fights pay cash and nobody is expected to use Nen.
 * At 200 everything changes: everyone uses it, and the floor's veterans
 * "welcome" newcomers who do not, which either opens their nodes or kills
 * them. A fighter there has 90 days to register a fight, is out after four
 * losses, and after ten wins can challenge a Floor Master for a floor.
 */
import { L, P, log } from '../history'
import type { Id, Person, World } from '../types'
import { at, orgK, placeK, rng } from '../world'
import { fight } from '../combat/aftermath'
import { power, inOrg } from '../people/person'
import { joinOrg, membership } from './orgs'
import { remember } from '../people/memory'

export function floor(p: Person): number {
  return (p.flags.floor as number) || 0
}

export function arenaResult(w: World, winners: Person[], losers: Person[], ev: Id) {
  const r = rng(w)
  const arena = orgK(w, 'arena')
  for (const p of winners) {
    const f0 = floor(p)
    let f1 = f0
    if (f0 < 200) f1 = Math.min(200, f0 + (f0 < 50 ? 50 : 10 + r.int(20)))
    else { p.flags.wins200 = ((p.flags.wins200 as number) || 0) + 1 }
    p.flags.floor = f1
    if (f0 < 200) p.jenny += 0.002 * f1 + (f1 > 150 ? 0.5 : 0)
    if (f0 < 200 && f1 >= 200) {
      p.fame += 4
      log(w, { type: 'arena', imp: p.major || p.owned ? 3 : 1, who: [p.id], at: arena.hq, cause: ev, text: `${P(p)} reaches the 200th floor of Heavens Arena, where every fighter uses Nen.` })
      p.flags.arena90 = w.t + 90
      if (!inOrg(p, arena.id)) joinOrg(w, p, arena, 1, { quiet: true })
    }
    if ((p.flags.wins200 as number) >= 10 && !p.flags.floorMaster) {
      p.flags.floorMaster = 1
      p.flags.floor = 230 + r.int(21)
      p.fame += 15
      const m = membership(p, arena.id)
      if (m) { m.rank = 2; m.title = 'Floor Master' }
      log(w, { type: 'arena', imp: p.major || p.owned ? 3 : 2, who: [p.id], at: arena.hq, cause: ev, text: `${P(p)} wins a tenth time on the 200th floors and takes a Floor Master's seat in Heavens Arena.` })
      remember(w, p, { k: 'floormaster', val: 55, str: 60, ev, text: 'Became a Floor Master of Heavens Arena.' })
    }
  }
  for (const p of losers) {
    const f0 = floor(p)
    if (f0 >= 200) {
      p.flags.losses200 = ((p.flags.losses200 as number) || 0) + 1
      if ((p.flags.losses200 as number) >= 4 && !p.flags.floorMaster) {
        p.flags.floor = 0
        p.flags.losses200 = 0
        p.flags.wins200 = 0
        log(w, { type: 'arena', imp: p.major ? 2 : 0, who: [p.id], at: arena.hq, cause: ev, text: `${P(p)} loses a fourth time on the 200th floors and is out of Heavens Arena.` })
      }
    } else {
      p.flags.floor = Math.max(1, f0 - 10)
    }
  }
}

/** Once a day, the arena's matches for anyone who came to fight. */
export function arenaDaily(w: World) {
  const r = rng(w)
  const place = placeK(w, 'arena')
  const here = at(w, place.id).filter((p) => p.act.k === 'arena' && p.hp > 0 && !p.conds.length && p.lastFight < w.t - 2)
  if (here.length < 2) {
    // Nobody to match with: the arena always has local fighters.
    for (const p of here) if (r.chance(0.5)) localBout(w, p)
    return
  }
  r.shuffle(here)
  here.sort((a, b) => floor(a) - floor(b))
  const used = new Set<Id>()
  for (let i = 0; i < here.length; i++) {
    const a = here[i]
    if (used.has(a.id)) continue
    const b = here.slice(i + 1).find((x) => !used.has(x.id) && Math.abs(floor(x) - floor(a)) <= 60)
    if (!b) { if (r.chance(0.5)) localBout(w, a); continue }
    used.add(a.id); used.add(b.id)
    // The 200th-floor welcome: a veteran picks on a newcomer without Nen.
    fight(w, { a: [a], b: [b], intentA: 'arena', place: place.id, arena: true, why: floor(a) >= 200 ? 'on the 200th floor' : 'in the ring', record: a.major || b.major || a.owned || b.owned })
  }
}

/** A bout against one of the tower's thousands of unnamed fighters. */
function localBout(w: World, p: Person) {
  const r = rng(w)
  const fl = floor(p)
  const lvl = fl >= 200 ? 45 + r.int(20) : 20 + fl / 5
  const opp = { name: fl >= 200 ? 'a 200th-floor fighter' : `a floor-${Math.max(1, fl)} fighter`, str: lvl, agi: lvl, tou: lvl, skill: lvl, weapon: 'fists', count: 1 }
  const out = fight(w, { a: [p], b: [], extrasB: [opp], intentA: 'arena', place: placeK(w, 'arena').id, arena: true, why: 'in the ring' })
  if (out.res.winner === 0) arenaResult(w, [p], [], out.ev)
  else if (out.res.winner === 1) arenaResult(w, [], [p], out.ev)
  void power; void L
}
