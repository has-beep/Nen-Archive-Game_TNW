/**
 * Greed Island. A Nen game on a real island, made by Ging and his friends.
 * Battera buys every copy he can and hires players to clear it; players
 * collect cards; some players decide killing the others is faster. Whoever
 * clears it leaves with three cards. One of them, Accompany, can take you to
 * anyone you have met.
 */
import { L, O, P, log } from '../history'
import type { Person, World } from '../types'
import { at, orgK, personK, placeK, rng, members } from '../world'
import { power } from '../people/person'
import { remember } from '../people/memory'
import { leaveGame, travel } from './travel'
import { fight } from '../combat/aftermath'
import { startStory, endStory } from '../story/storyteller'

/** Battera's selection: every September in Yorknew, Nen users who can show
 *  him something get a seat in a copy of the game. */
export function batteraSelection(w: World) {
  const r = rng(w)
  const b = personK(w, 'battera')
  const yk = placeK(w, 'yorknew')
  if (!b || !b.alive || w.flags.giCleared) return
  const pool = at(w, yk.id).filter((p) => p.nen.awake && p.nen.tech.ren > 20 && !p.flags.giAccess && p.species === 'human' && !p.orgs.some((m) => ['troupe', 'zoldyck', 'kakin_royal'].includes(w.orgs[m.org].key)))
  const keen = pool.filter((p) => p.dreams.some((d) => d.k === 'clear' || d.k === 'wealth' || d.k === 'find') || p.facets.curiosity > 65)
  const chosen = keen.filter((p) => power(p) > 22 + r.next() * 20).slice(0, 10)
  if (!chosen.length) return
  for (const p of chosen) {
    p.flags.giAccess = 1
    if (!p.dreams.some((d) => d.k === 'clear')) p.dreams.push({ k: 'clear', pri: 55 + r.int(25), prog: 0, since: w.t })
  }
  const ev = log(w, { type: 'job', imp: chosen.some((p) => p.major) ? 3 : 2, who: [b.id, ...chosen.map((p) => p.id)], at: yk.id, text: `${P(b)} holds his selection in ${L(yk)}. ${chosen.length} Nen users pass the test and are given a seat in Greed Island: ${chosen.slice(0, 5).map((p) => P(p)).join(', ')}${chosen.length > 5 ? ' and others' : ''}.` })
  startStory(w, 'quest', 'Greed Island', chosen.slice(0, 6).map((p) => p.id), ev, 'gi')
}

/** Daily inside the game: the Bombers hunt players with good hands. */
export function greedDaily(w: World) {
  const r = rng(w)
  const gi = placeK(w, 'greed')
  const inside = at(w, gi.id)
  if (!inside.length) return
  const bombers = orgK(w, 'bombers')
  const gangs = members(w, bombers.id).filter((p) => p.loc === gi.id && !p.trip)
  if (gangs.length && r.chance(0.015)) {
    const prey = inside.filter((p) => !gangs.includes(p) && p.dreams.some((d) => d.k === 'clear' && d.prog > 55))
    if (prey.length) {
      const v = prey.sort((a, b) => (b.dreams.find((d) => d.k === 'clear')?.prog ?? 0) - (a.dreams.find((d) => d.k === 'clear')?.prog ?? 0))[0]
      const allies = inside.filter((p) => p !== v && p.party != null && p.party === v.party)
      fight(w, { a: gangs.slice(0, 3), b: [v, ...allies.slice(0, 3)], intentA: 'kill', place: gi.id, why: 'in Greed Island, over the cards', record: true })
    }
  }
  // Players who like each other team up.
  for (const p of inside) {
    if (p.party != null) continue
    const friend = inside.find((q) => q !== p && (p.rel[q.id]?.aff ?? 0) > 35 && q.dreams.some((d) => d.k === 'clear'))
    if (friend && p.dreams.some((d) => d.k === 'clear')) {
      const id = w.parties.length ? w.parties[w.parties.length - 1].id + 1 : 1
      const members = [p.id, friend.id]
      w.parties.push({ id, members, leader: power(p) >= power(friend) ? p.id : friend.id, purpose: 'Clearing Greed Island', dream: { k: 'clear' }, t: w.t, until: w.t + 400 })
      p.party = id; friend.party = id
      if (p.major || friend.major) log(w, { type: 'bond', imp: 2, who: [p.id, friend.id], at: gi.id, text: `${P(p)} and ${P(friend)} team up to clear Greed Island.` })
    }
  }
}

export function clearGame(w: World, p: Person) {
  if (w.flags.giCleared) return
  w.flags.giCleared = w.t
  const gi = placeK(w, 'greed')
  const team = p.party != null ? w.parties.find((x) => x.id === p.party)?.members.map((id) => w.people[id]).filter(Boolean) || [p] : [p]
  for (const q of team) {
    q.fame += 20
    for (const d of q.dreams) if (d.k === 'clear') { d.done = w.t; d.prog = 100 }
  }
  const ev = log(w, { type: 'quest', imp: 4, who: team.map((q) => q.id), at: gi.id, text: `${team.map((q) => P(q)).join(' and ')} ${team.length > 1 ? 'clear' : 'clears'} Greed Island. Three cards come out with them: Breath of Archangel, Accompany, and Patch of Shade.` })
  endStory(w, 'gi', ev, `${p.name} cleared the game.`)
  const b = personK(w, 'battera')
  if (b?.alive) {
    b.jenny -= 500
    p.jenny += 500
    log(w, { type: 'job', imp: 2, who: [b.id, p.id], cause: ev, text: `${P(b)} pays the reward of 500 million Jenny. Whether the Archangel card came in time for the woman he did it all for, he does not say.` })
  }
  // Accompany: go to anyone you have met. If someone is searching for Ging...
  for (const q of team) {
    const d = q.dreams.find((x) => x.k === 'find' && !x.done)
    if (!d || d.target == null) continue
    const t = w.people[d.target]
    if (t?.alive) {
      q.seen[t.id] = [t.loc, w.t]
      log(w, { type: 'quest', imp: 3, who: [q.id, t.id], cause: ev, text: `${P(q)} uses Accompany, naming ${P(t)}. The card goes where the name is.` })
      travel(w, q, t.loc, true)
    }
  }
  for (const q of team) { remember(w, q, { k: 'clear', val: 70, str: 75, ev, text: 'Cleared Greed Island.' }); if (q.loc === gi.id && !q.trip) leaveGame(w, q) }
}

export { O }
