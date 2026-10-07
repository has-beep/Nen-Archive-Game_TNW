/**
 * When people who mean each other harm are in the same place.
 *
 * A hunt ends in a fight only when the hunter finds the target, decides the
 * odds are worth it, and is not held back by their own rules. Whoever is
 * guarding the target, or travelling with either side, joins in. Killing a
 * contract target pays; bringing in a bounty puts them in the Association's
 * cells in Swardani.
 */
import { L, P, log } from '../history'
import type { Person, World } from '../types'
import { alive, at, placeK, rng, touch } from '../world'
import { hpMax, isFree, power } from '../people/person'
import { hasBond } from '../people/relations'
import { fight } from '../combat/aftermath'
import { odds } from '../combat/combat'
import { restraint } from '../society/rules'
import { payContract } from '../society/economy'
import { vowMult } from '../nen/vows'
import { remember } from '../people/memory'

export function encounters(w: World) {
  const r = rng(w)
  const hunters = alive(w).filter((p) => p.plan?.k === 'hunt' && p.plan.target != null && !p.trip && isFree(p))
  r.shuffle(hunters)
  for (const p of hunters) {
    if (!p.alive || p.lastFight === w.t || !p.plan) continue
    const t = w.people[p.plan.target!]
    if (!t || !t.alive) { p.plan = null; continue }
    if (t.loc !== p.loc || t.trip || t.lastFight === w.t) continue
    if (t.conds.some((c) => c.k === 'jailed' || c.k === 'captive')) continue
    const intent = (p.plan.data?.intent as 'kill' | 'capture' | 'duel') || 'kill'
    // Rules first: a disciplined Hunter will not go after another Hunter.
    const hold = restraint(w, p, t, intent)
    if (hold < 1 && r.chance(1 - hold)) {
      if (p.major || p.owned) log(w, { type: 'misc', imp: 1, who: [p.id, t.id], at: p.loc, text: `${P(p)} finds ${P(t)} in ${L(w.places[p.loc])}, and holds back. There are rules.` })
      p.plan = null
      continue
    }
    // Sides: whoever travels with or guards each of them.
    const here = at(w, p.loc).filter((q) => isFree(q) && q.lastFight !== w.t && q !== p && q !== t)
    const sideA = [p, ...here.filter((q) => q.party != null && q.party === p.party && (q.rel[t.id]?.aff ?? 0) < 30).slice(0, 3)]
    const guards = here.filter((q) => !sideA.includes(q) && (q.dreams.some((d) => d.k === 'protect' && d.target === t.id && !d.done) || (q.act.k === 'guard' && q.act.with === t.id) || (q.party != null && q.party === t.party) || ((q.rel[t.id]?.aff ?? 0) > 70 && q.facets.bravery > 55 && (q.rel[p.id]?.aff ?? 0) < 20)))
    const sideB = [t, ...guards.slice(0, 4)]
    // The odds, as the hunter sees them.
    const mult = vowMult(w, p, t)
    const est = odds(sideA, sideB) * Math.min(1.6, mult)
    const desperate = p.mood.anger > 80 || p.flags.allIn === t.id || p.nen.vows.some((v) => v.person === t.id)
    if (est < 0.3 && !desperate && intent !== 'duel' && r.chance(0.8)) {
      if (p.major || p.owned) log(w, { type: 'misc', imp: 1, who: [p.id, t.id], at: p.loc, text: `${P(p)} finds ${P(t)}, sizes them up, and decides not today.` })
      p.plan.until = Math.min(p.plan.until, w.t + 1)
      continue
    }
    // An assassin strikes from hiding when they can.
    const ambush = intent === 'kill' && (p.role === 'assassin' || p.skills.stealth > 60) && p.nen.tech.zetsu > 30
    // Gon's vow: everything, now.
    if (p.flags.allIn === t.id) {
      p.nen.lvl = Math.max(p.nen.lvl, p.nen.cap + 25)
      p.attrs.str = Math.max(p.attrs.str, 120); p.attrs.agi = Math.max(p.attrs.agi, 110); p.attrs.tou = Math.max(p.attrs.tou, 110)
      log(w, { type: 'vow', imp: 5, who: [p.id, t.id], at: p.loc, text: `${P(p)} lets the vow take everything. The body that stands in front of ${P(t)} is the one ${P(p)} would have had after a lifetime of training.` })
    }
    const out = fight(w, { a: sideA, b: sideB, intentA: intent, place: p.loc, why: p.plan.why, cause: p.plan.ev, ambush, record: p.major || t.major || p.owned || t.owned })
    if (p.flags.allIn === t.id) { p.flags.allIn = 0; p.nen.burnedOut = true; p.nen.lvl = 5; p.hp = Math.max(1, hpMax(p) * 0.05) }
    // Contracts.
    const cid = p.plan?.data?.contract as number | undefined
    const c = cid != null ? w.contracts.find((x) => x.id === cid) : undefined
    if (c && c.status === 'taken') {
      if (c.k === 'assassination' && !t.alive) payContract(w, c, p, out.ev)
      if (c.k === 'bounty' && (out.captured.includes(t) || !t.alive)) {
        payContract(w, c, p, out.ev)
        if (t.alive) jail(w, t, p)
      }
    }
    if (!t.alive || out.captured.includes(t)) p.plan = null
    else if (out.fled.includes(p) || out.res.winner === 1) { p.plan = null; p.nextThink = w.t + 1 }
    if (intent === 'duel') {
      p.flags[`rematch:${t.id}`] = w.t + 120 + r.int(240)
      if (out.res.winner === 0 && out.winners.includes(p)) for (const d of p.dreams) if (d.k === 'defeat' && d.target === t.id && !d.done) {
        d.done = w.t
        log(w, { type: 'misc', imp: p.major || t.major ? 3 : 1, who: [p.id, t.id], at: p.loc, cause: out.ev, text: `${P(p)} has beaten ${P(t)}. It was everything they wanted it to be.` })
      }
      p.plan = null
    }
  }
  grudges(w)
}

/** Sworn enemies who run into each other. */
function grudges(w: World) {
  const r = rng(w)
  if (!r.chance(0.5)) return
  for (const p of alive(w)) {
    if (!isFree(p) || p.lastFight === w.t || p.facets.aggression < 50 || p.plan?.k === 'hunt') continue
    const foes = at(w, p.loc).filter((q) => q !== p && isFree(q) && q.lastFight !== w.t && hasBond(p.rel[q.id], 'nemesis'))
    if (!foes.length || !r.chance(0.15 + p.facets.vengefulness / 600)) continue
    const t = foes[0]
    if (odds([p], [t]) < 0.35 && p.mood.anger < 70) continue
    if (restraint(w, p, t, 'kill') < 0.3) continue
    fight(w, { a: [p], b: [t], intentA: p.facets.cruelty > 50 ? 'kill' : 'duel', place: p.loc, why: 'over an old grudge', record: p.major || t.major })
  }
}

function jail(w: World, t: Person, by: Person) {
  const sw = placeK(w, 'swardani')
  t.conds = t.conds.filter((c) => c.k !== 'captive')
  t.conds.push({ k: 'jailed', until: w.t + 180, by: by.id, note: 'the Association\'s cells' })
  t.loc = sw.id
  t.trip = undefined
  t.plan = null
  touch(w, t)
  log(w, { type: 'crime', imp: t.major ? 3 : 2, who: [t.id, by.id], at: sw.id, text: `${P(by)} delivers ${P(t)} to the Hunter Association. ${P(t)} goes into the cells in ${L(sw)}.` })
  remember(w, t, { k: 'jailed', val: -45, str: 60, who: by.id, text: `${by.name} put me in a cell.` })
  void power
}
