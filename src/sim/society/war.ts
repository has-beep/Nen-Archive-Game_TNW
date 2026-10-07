/**
 * War between nations, and the weapons of last resort.
 *
 * Armies are abstract: troops, armour, air power and navies, multiplied by
 * technology, readiness and morale, fighting over places along a front. Named
 * people still matter: officers and Nen users on the front fight each other
 * in person, and a strong enough Nen user is worth a regiment.
 *
 * The Poor Man's Rose is a miniature bomb whose blast kills everything near
 * it and whose poison kills whatever the blast missed, slowly. Its production
 * is banned by treaty; the stock that already existed was never destroyed.
 * Using it is a crime against the whole world, and the world answers.
 */
import { L, N, P, log } from '../history'
import type { Front, Id, Nation, Person, War, World } from '../types'
import { alive, at, nationK, rng, touch } from '../world'
import { hpMax, power } from '../people/person'
import { kill } from '../events/death'
import { fight } from '../combat/aftermath'
import { startStory, endStory } from '../story/storyteller'
import { remember } from '../people/memory'
import { travel } from './travel'

export function atWar(w: World, n: Id): War | undefined {
  return w.wars.find((x) => !x.end && !x.factions && (x.a.includes(n) || x.d.includes(n)))
}

export function warBetween(w: World, a: Id, b: Id): War | undefined {
  return w.wars.find((x) => !x.end && !x.factions && ((x.a.includes(a) && x.d.includes(b)) || (x.a.includes(b) && x.d.includes(a))))
}

export function strength(n: Nation): number {
  const m = n.mil
  return (m.troops * 0.004 + m.armor * 0.9 + m.air * 1.1 + m.navy * 0.6) * (0.5 + n.tech) * (0.5 + m.readiness / 100) * (0.5 + m.morale / 100)
}

export function declareWar(w: World, a: Nation, d: Nation, goal: string, cause?: Id): War {
  const front: Front[] = d.capital >= 0 ? [{ place: d.capital, a: 0, d: 0, held: 'd' }] : []
  const extra = w.places.filter((p) => p.nation === d.id && p.id !== d.capital && p.kind !== 'wild').slice(0, 2)
  for (const p of extra) front.push({ place: p.id, a: 0, d: 0, held: 'd' })
  const wr: War = { id: w.wars.length + 1, a: [a.id], d: [d.id], factions: false, name: `The ${a.short}-${d.short} War`, cause, goal, start: w.t, fronts: front, score: 0, dead: [0, 0], civ: 0 }
  // Allies honour their alliances.
  for (const n of w.nations) {
    if (n === a || n === d) continue
    if (n.rel[d.id]?.ally && !n.rel[a.id]?.ally) wr.d.push(n.id)
    else if (n.rel[a.id]?.ally && !n.rel[d.id]?.ally && n.traits.militarism > 50) wr.a.push(n.id)
  }
  w.wars.push(wr)
  a.mil.readiness = Math.min(100, a.mil.readiness + 30)
  d.mil.readiness = Math.min(100, d.mil.readiness + 40)
  const ev = log(w, { type: 'war', imp: 5, nats: wr.a.concat(wr.d), cause, text: `War. The ${N(a)} attacks the ${N(d)}${goal ? `, to ${goal}` : ''}.${wr.d.length > 1 || wr.a.length > 1 ? ` ${wr.a.length + wr.d.length - 2} other ${wr.a.length + wr.d.length - 2 === 1 ? 'nation joins' : 'nations join'} in.` : ''}` })
  wr.ev = ev
  startStory(w, 'war', wr.name, [a.ruler, d.ruler].filter((x) => x >= 0), ev, `war-${wr.id}`)
  // Soldiers and officers of both sides head for the front.
  for (const p of alive(w)) {
    const side = wr.a.includes(p.nation) ? 'a' : wr.d.includes(p.nation) ? 'd' : null
    if (!side || !/soldier|officer/.test(p.role)) continue
    const f = rng(w).pick(wr.fronts)
    if (f) { p.plan = { k: 'go', place: f.place, until: w.t + 200, why: `Called to the front in ${w.places[f.place].name}`, ev }; p.nextThink = w.t }
  }
  return wr
}

/** Daily: battles along every front. */
export function warsDaily(w: World) {
  const r = rng(w)
  for (const wr of w.wars) {
    if (wr.end || wr.factions) continue
    const A = wr.a.map((id) => w.nations[id]), D = wr.d.map((id) => w.nations[id])
    const sa = A.reduce((s, n) => s + strength(n), 0), sd = D.reduce((s, n) => s + strength(n), 0) * 1.25 // defending is easier
    for (const f of wr.fronts) {
      // Named fighters on the front can swing it.
      const here = at(w, f.place)
      const na = here.filter((p) => wr.a.includes(p.nation) && p.nen.awake).reduce((s, p) => s + power(p) / 6, 0)
      const nd = here.filter((p) => wr.d.includes(p.nation) && p.nen.awake).reduce((s, p) => s + power(p) / 6, 0)
      f.a = sa / wr.fronts.length + na
      f.d = sd / wr.fronts.length + nd
      const ratio = f.a / Math.max(1, f.d)
      const lossA = (0.6 + r.next()) * f.d * 0.04, lossD = (0.6 + r.next()) * f.a * 0.04
      wr.dead[0] += Math.round(lossA * 20)
      wr.dead[1] += Math.round(lossD * 20)
      for (const n of A) n.mil.troops = Math.max(0, n.mil.troops - lossA * 0.6)
      for (const n of D) n.mil.troops = Math.max(0, n.mil.troops - lossD * 0.6)
      wr.civ += 0.4 * w.places[f.place].pop / 1000
      wr.score = Math.max(-100, Math.min(100, wr.score + (ratio - 1) * 1.5))
      if (f.held === 'd' && ratio > 1.6 && r.chance(0.05)) {
        f.held = 'a'
        w.places[f.place].occupier = A[0].id
        log(w, { type: 'war', imp: 4, nats: wr.a.concat(wr.d), at: f.place, cause: wr.ev, text: `${L(w.places[f.place])} falls to the ${N(A[0])}.` })
      } else if (f.held === 'a' && ratio < 0.7 && r.chance(0.05)) {
        f.held = 'd'
        w.places[f.place].occupier = undefined
        log(w, { type: 'war', imp: 3, nats: wr.a.concat(wr.d), at: f.place, cause: wr.ev, text: `The ${N(D[0])} retakes ${L(w.places[f.place])}.` })
      }
      // Officers meet on the field.
      if (r.chance(0.15)) {
        const ma = here.filter((p) => wr.a.includes(p.nation) && /soldier|officer/.test(p.role) && !p.conds.length)
        const md = here.filter((p) => wr.d.includes(p.nation) && /soldier|officer/.test(p.role) && !p.conds.length)
        if (ma.length && md.length) fight(w, { a: [r.pick(ma)], b: [r.pick(md)], intentA: 'war', place: f.place, why: `in ${wr.name}`, cause: wr.ev, extrasA: [{ name: 'soldier', str: 50, agi: 45, tou: 50, skill: 55, weapon: 'rifle', count: 3 }], extrasB: [{ name: 'soldier', str: 50, agi: 45, tou: 50, skill: 55, weapon: 'rifle', count: 3 }] })
      }
      // Civilians who can leave, leave.
      for (const p of here) if (!wr.a.includes(p.nation) && !wr.d.includes(p.nation) && !p.trip && p.facets.bravery < 70 && r.chance(0.2)) travel(w, p, p.home !== f.place ? p.home : w.nations[p.nation]?.capital ?? p.home, true)
    }
    for (const n of A.concat(D)) { n.weariness = Math.min(100, n.weariness + 0.25); n.mil.morale = Math.max(5, n.mil.morale - 0.05) }
    // Desperation: a ruthless government losing badly reaches for the Rose.
    const loser = wr.score < -55 ? A[0] : wr.score > 55 ? D[0] : null
    if (loser && loser.arsenal.roses > 0 && !wr.roseUsed && loser.traits.ruthless > 65 && r.chance(0.01)) {
      const enemy = loser === A[0] ? D[0] : A[0]
      const tgt = wr.fronts.find((f) => (f.held === 'a') === (loser === D[0]))?.place ?? enemy.capital
      roseStrike(w, loser, tgt, wr.ev)
      wr.roseUsed = true
    }
    // Peace.
    const tired = A.concat(D).every((n) => n.weariness > 60) || Math.abs(wr.score) >= 100 || w.t - wr.start > 900
    if (tired && r.chance(0.02)) endWar(w, wr)
  }
}

export function endWar(w: World, wr: War) {
  wr.end = w.t
  const A = w.nations[wr.a[0]], D = w.nations[wr.d[0]]
  const winner = wr.score > 25 ? A : wr.score < -25 ? D : null
  wr.outcome = winner ? `${winner.name} won` : 'Stalemate'
  for (const f of wr.fronts) if (winner === A && f.held === 'a') { w.places[f.place].nation = A.id; w.places[f.place].occupier = undefined } else w.places[f.place].occupier = undefined
  for (const id of wr.a.concat(wr.d)) { const n = w.nations[id]; n.weariness = 20; n.mil.readiness = 40 }
  if (A && D) { A.rel[D.id] = { ...(A.rel[D.id] || { op: 0, ally: false, nap: false, trade: false, sanction: false }), op: -30, nap: true }; D.rel[A.id] = { ...(D.rel[A.id] || { op: 0, ally: false, nap: false, trade: false, sanction: false }), op: -40, nap: true } }
  const ev = log(w, { type: 'war', imp: 5, nats: wr.a.concat(wr.d), cause: wr.ev, text: `${wr.name} ends. ${winner ? `The ${N(winner)} wins` : 'Neither side wins'}. Dead: about ${(wr.dead[0] + wr.dead[1]).toLocaleString('en-US')} soldiers and ${Math.round(wr.civ * 1000).toLocaleString('en-US')} civilians.` })
  endStory(w, `war-${wr.id}`, ev, wr.outcome)
}

/** A nation drops a Rose on a place. */
export function roseStrike(w: World, n: Nation, place: Id, cause?: Id) {
  const r = rng(w)
  const pl = w.places[place]
  n.arsenal.roses--
  const deadK = Math.round(pl.pop * (0.3 + r.next() * 0.3))
  pl.pop -= deadK
  pl.hazard = 1
  pl.hazardUntil = w.t + 3650
  pl.hazardKind = 'rose'
  const ev = log(w, { type: 'war', imp: 5, nats: [n.id, pl.nation], at: place, cause, text: `The ${N(n)} drops a Poor Man's Rose on ${L(pl)}. About ${(deadK * 1000).toLocaleString('en-US')} people die in the blast. The poison will kill more for years.` })
  for (const p of at(w, place).slice()) {
    const strong = p.nen.awake && p.nen.lvl > 80 && r.chance(0.4)
    if (!strong) kill(w, p, { cause: 'the Poor Man\'s Rose', ev, quiet: !p.major })
    else p.conds.push({ k: 'contaminated', until: w.t + 400, p: 1.5, note: 'the Rose\'s poison' })
  }
  // The whole world answers a breach of the Rose treaty.
  for (const o of w.nations) {
    if (o === n) continue
    o.rel[n.id] = { ...(o.rel[n.id] || { op: 0, ally: false, nap: false, trade: false, sanction: false }), op: Math.max(-100, (o.rel[n.id]?.op ?? 0) - 50), sanction: true }
  }
  n.stability = Math.max(0, n.stability - 20)
  touch(w)
  return ev
}

/**
 * The Rose carried in a body (Netero's). Its bearer dies; the target takes the
 * blast, and then the poison, which no amount of aura can undo.
 */
export function useRose(w: World, bearer: Person, target: Person, cause?: Id, remote = false) {
  const pl = w.places[bearer.loc]
  const ev = log(w, { type: 'war', imp: 5, who: [bearer.id, target.id], at: bearer.loc, cause, text: remote
    ? `${P(bearer)} has lost. Far from ${L(pl)}, on open ground, he smiles and stops his own heart. The Poor Man's Rose inside him blooms into a red flower of fire, and ${P(target)} is at the centre of it.`
    : `${P(bearer)} has lost. He smiles, and stops his own heart. The Poor Man's Rose inside him goes off, and ${L(pl)} disappears in a red flower of fire.` })
  delete bearer.flags.rose
  kill(w, bearer, { cause: 'setting off the Poor Man\'s Rose', ev, quiet: false })
  target.hp = Math.max(1, hpMax(target) * 0.08)
  target.conds.push({ k: 'contaminated', until: w.t + 400, p: 4, note: 'the Rose\'s poison' })
  remember(w, target, { k: 'rose', val: -60, str: 90, ev, text: 'Survived the Rose. The poison is inside now.' })
  if (remote) return ev
  for (const p of at(w, bearer.loc).slice()) {
    if (p === target || !p.alive) continue
    if (p.nen.lvl > 75 && rng(w).chance(0.5)) p.conds.push({ k: 'contaminated', until: w.t + 300, p: 2.5, note: 'the Rose\'s poison' })
    else kill(w, p, { cause: 'the Poor Man\'s Rose', ev, quiet: !p.major })
  }
  pl.hazard = 0.8
  pl.hazardUntil = w.t + 2000
  pl.hazardKind = 'rose'
  pl.pop *= 0.7
  return ev
}

export { nationK, power }
