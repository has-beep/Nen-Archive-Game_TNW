/**
 * Relationships: how two people feel about each other, the bonds between
 * them, and the everyday interactions that move those feelings.
 *
 * A relationship is one-sided data (what A thinks of B). Bonds are mutual
 * facts (friends, siblings, teacher and student) and are always set on both
 * sides together.
 */
import { BONDS, BOND_PAIR, type Bond } from '../constants'
import { P, L, log } from '../history'
import type { Id, Person, Rel, World } from '../types'
import { relOrNew } from './person'
import { compatibility } from './traits'
import { remember, clamp } from './memory'
import { gossip, see } from './knowledge'
import { rng } from '../world'

const BIT: Record<Bond, number> = Object.fromEntries(BONDS.map((b, i) => [b, 1 << i])) as Record<Bond, number>

export function hasBond(r: Rel | undefined, b: Bond): boolean {
  return !!r && (r.bonds & BIT[b]) !== 0
}
export function bondsOf(r: Rel | undefined): Bond[] {
  if (!r) return []
  return BONDS.filter((b) => (r.bonds & BIT[b]) !== 0)
}
export function setBond(w: World, a: Person, b: Person, bond: Bond, on = true) {
  const ra = relOrNew(w, a, b.id), rb = relOrNew(w, b, a.id)
  const back = BOND_PAIR[bond]
  if (on) { ra.bonds |= BIT[bond]; rb.bonds |= BIT[back] }
  else { ra.bonds &= ~BIT[bond]; rb.bonds &= ~BIT[back] }
}
export function bonded(a: Person, b: Id, bond: Bond): boolean {
  return hasBond(a.rel[b], bond)
}

/** Family bonds that make someone kin. */
export function isKin(a: Person, b: Id): boolean {
  const r = a.rel[b]
  return !!r && (r.bonds & (BIT.parent | BIT.child | BIT.sibling | BIT.spouse | BIT.guardian | BIT.ward)) !== 0
}

/** People a would grieve, protect and avenge. */
export function lovedOnes(w: World, a: Person, min = 50): Person[] {
  const out: Person[] = []
  for (const id in a.rel) {
    const r = a.rel[id]
    const q = w.people[+id]
    if (!q || !q.alive) continue
    if (r.aff >= min || isKin(a, +id) && r.aff > 10) out.push(q)
  }
  return out
}

export function change(w: World, a: Person, b: Person, d: Partial<Pick<Rel, 'aff' | 'trust' | 'resp' | 'fear' | 'attr' | 'fam' | 'debt'>>) {
  const r = relOrNew(w, a, b.id)
  if (d.aff) r.aff = clamp(r.aff + d.aff, -100, 100)
  if (d.trust) r.trust = clamp(r.trust + d.trust, -100, 100)
  if (d.resp) r.resp = clamp(r.resp + d.resp, -100, 100)
  if (d.fear) r.fear = clamp(r.fear + d.fear, 0, 100)
  if (d.attr) r.attr = clamp(r.attr + d.attr, 0, 100)
  if (d.fam) r.fam = clamp(r.fam + d.fam, 0, 100)
  if (d.debt) r.debt = r.debt + d.debt
  r.t = w.t
  return r
}

/**
 * Everyday contact between two people in the same place. Returns a short
 * description of what happened, for the sheet's "this week" line.
 */
export function interact(w: World, a: Person, b: Person, focus = false): string {
  const r = rng(w)
  see(w, a, b); see(w, b, a)
  const ra = relOrNew(w, a, b.id), rb = relOrNew(w, b, a.id)
  const compat = compatibility(a, b)
  const fa = a.facets
  let what = 'talks with'
  // Grief: the empathetic comfort the grieving, and it bonds them.
  if (b.mood.grief > 40 && fa.empathy > 55 && r.chance(0.7)) {
    b.mood.grief = Math.max(0, b.mood.grief - 12)
    change(w, b, a, { aff: 6, trust: 4, fam: 3 })
    change(w, a, b, { aff: 3, fam: 3 })
    what = 'comforts'
  } else if (compat < -0.25 && (fa.composure < 45 || fa.pride > 70) && r.chance(0.35 + (-compat) * 0.4)) {
    // A clash of values turns into an argument; a cruel or proud person makes it personal.
    const bad = fa.cruelty > 60 || fa.pride > 75
    change(w, a, b, { aff: -4, fam: 2 })
    change(w, b, a, { aff: bad ? -9 : -5, fam: 2 })
    b.mood.anger = Math.min(100, b.mood.anger + (bad ? 18 : 8))
    what = bad ? 'insults' : 'argues with'
    if (bad && (focus || a.major || b.major) && r.chance(0.25)) {
      log(w, { type: 'social', imp: a.major || b.major ? 1 : 0, who: [a.id, b.id], at: a.loc, text: `${P(a)} and ${P(b)} fall out badly in ${L(w.places[a.loc])}.` })
    }
  } else {
    const warmth = 2 + compat * 6 + (fa.sociability - 50) / 25 + r.next() * 3
    change(w, a, b, { aff: warmth * 0.9, trust: warmth * 0.4, fam: 3 })
    change(w, b, a, { aff: warmth, trust: warmth * 0.4, fam: 3 })
    if (ra.fam > 40 && r.chance(0.3)) what = r.pick(['confides in', 'laughs with', 'shares a meal with', 'trades stories with'])
  }
  // Talk spreads what people know.
  gossip(w, a, b)
  if (r.chance(0.4)) gossip(w, b, a)
  checkBonds(w, a, b)
  return what
}

/** Fighting side by side, or against each other, changes people. */
export function sparred(w: World, a: Person, b: Person, aWon: boolean) {
  const win = aWon ? a : b, lose = aWon ? b : a
  change(w, lose, win, { resp: 7, fam: 4 })
  change(w, win, lose, { resp: 3, fam: 4 })
  // Proud fighters who are close in strength become rivals.
  if (win.facets.pride > 55 && lose.facets.pride > 55 && Math.abs(win.nen.lvl - lose.nen.lvl) < 12) {
    const rl = relOrNew(w, lose, win.id)
    if (rl.resp > 35 && rl.aff > -40 && !hasBond(rl, 'rival') && rng(w).chance(0.25)) {
      setBond(w, a, b, 'rival')
      log(w, { type: 'bond', imp: a.major || b.major ? 2 : 1, who: [a.id, b.id], at: a.loc, text: `${P(a)} and ${P(b)} become rivals.` })
    }
  }
}

export function foughtTogether(w: World, a: Person, b: Person) {
  change(w, a, b, { aff: 6, trust: 8, resp: 4, fam: 5 })
  change(w, b, a, { aff: 6, trust: 8, resp: 4, fam: 5 })
  checkBonds(w, a, b)
}

export function savedBy(w: World, saved: Person, saver: Person, ev?: Id) {
  change(w, saved, saver, { aff: 22, trust: 25, debt: 1, resp: 10 })
  change(w, saver, saved, { aff: 8, fam: 5 })
  saver.stats.saved++
  remember(w, saved, { k: 'saved', who: saver.id, val: 60, str: 75, ev, text: `${saver.name} saved my life.` })
  checkBonds(w, saved, saver)
}

export function betrayed(w: World, victim: Person, by: Person, ev?: Id) {
  change(w, victim, by, { aff: -55, trust: -80 })
  victim.mood.anger = Math.min(100, victim.mood.anger + 40)
  remember(w, victim, { k: 'betrayed', who: by.id, val: -70, str: 85, ev, text: `${by.name} betrayed me.` })
  setBond(w, victim, by, 'friend', false)
  setBond(w, victim, by, 'bestFriend', false)
}

/** Friendships form and break as feelings cross thresholds. */
export function checkBonds(w: World, a: Person, b: Person) {
  const ra = a.rel[b.id], rb = b.rel[a.id]
  if (!ra || !rb) return
  const big = a.major || b.major || a.owned || b.owned
  const formal = hasBond(ra, 'master') || hasBond(ra, 'servant') || hasBond(ra, 'employer') || hasBond(ra, 'employee')
  if (!hasBond(ra, 'friend') && !formal && !isKin(a, b.id) && !hasBond(ra, 'spouse') && ra.aff >= 42 && rb.aff >= 42 && ra.fam >= 30 && ra.trust >= 15 && rb.trust >= 15) {
    setBond(w, a, b, 'friend')
    log(w, { type: 'bond', imp: big ? 2 : 1, who: [a.id, b.id], at: a.loc, text: `${P(a)} and ${P(b)} become friends.` })
    remember(w, a, { k: 'friend', who: b.id, val: 30, str: 40, text: `Became friends with ${b.name}.` })
    remember(w, b, { k: 'friend', who: a.id, val: 30, str: 40, text: `Became friends with ${a.name}.` })
  }
  if (hasBond(ra, 'friend') && !formal && !hasBond(ra, 'bestFriend') && !isKin(a, b.id) && ra.aff >= 78 && rb.aff >= 78 && ra.trust >= 60 && rb.trust >= 60 && ra.fam >= 60) {
    setBond(w, a, b, 'bestFriend')
    log(w, { type: 'bond', imp: big ? 3 : 2, who: [a.id, b.id], at: a.loc, text: `${P(a)} and ${P(b)} are best friends now, the kind who would die for each other.` })
  }
  if (hasBond(ra, 'friend') && (ra.aff < 5 || rb.aff < 5)) {
    setBond(w, a, b, 'friend', false)
    setBond(w, a, b, 'bestFriend', false)
    log(w, { type: 'bond', imp: big ? 2 : 0, who: [a.id, b.id], at: a.loc, text: `${P(a)} and ${P(b)} are no longer friends.` })
  }
  if (!hasBond(ra, 'nemesis') && ra.aff <= -75 && a.facets.vengefulness > 60) {
    setBond(w, a, b, 'nemesis')
  }
}

/** Relationships nobody tends fade; acquaintances are forgotten entirely, so
 *  the relationship table stays a manageable size. */
export function decayRelations(w: World, p: Person, days: number) {
  const ids = Object.keys(p.rel)
  for (const id of ids) {
    const r = p.rel[+id]
    const idle = w.t - r.t
    if (idle < 60) continue
    if (r.bonds === 0) {
      r.fam = Math.max(0, r.fam - 0.08 * days)
      if (r.aff > 0) r.aff = Math.max(0, r.aff - 0.03 * days)
      if (r.fam <= 0 && Math.abs(r.aff) < 8 && r.fear < 5 && Math.abs(r.debt) < 1) delete p.rel[+id]
    }
  }
  const left = Object.keys(p.rel)
  if (left.length > 120) {
    // Keep the people who matter.
    const sorted = left.map(Number).sort((x, y) => weight(p.rel[y]) - weight(p.rel[x]))
    for (const id of sorted.slice(110)) if (p.rel[id].bonds === 0) delete p.rel[id]
  }
}

function weight(r: Rel): number {
  return Math.abs(r.aff) + r.fam / 2 + r.fear + (r.bonds ? 200 : 0) + Math.abs(r.debt) * 20
}
