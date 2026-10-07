/**
 * Personality generation.
 *
 * The series has a folk theory, voiced by Hisoka, that Nen type follows
 * temperament: Enhancers are simple and determined, Transmuters whimsical
 * liars, Emitters impatient and hot-headed, Conjurers serious and high-strung,
 * Manipulators logical and stubborn, Specialists independent and charismatic.
 * The Nen Archive quiz is built on the same idea, so generated people lean
 * the same way. Lean, not lock: plenty of canon characters break it.
 */
import { FACETS, VALUES } from '../constants'
import type { Facet, NenType, Value } from '../constants'
import type { Rng } from '../rng'

export const TYPE_LEAN: Record<NenType, Partial<Record<Facet, number>>> = {
  0: { honesty: 12, impulsivity: 10, bravery: 8, whimsy: -6, pride: 4, composure: -3 },
  1: { honesty: -16, whimsy: 18, loyalty: -8, curiosity: 6 },
  2: { whimsy: -12, discipline: 12, composure: -7, honesty: 4, sociability: -4 },
  3: { curiosity: 10, sociability: -6, ambition: 8, pride: 8, trust: -6 },
  4: { discipline: 6, empathy: -6, pride: 6, sociability: -4, impulsivity: -8, composure: 6 },
  5: { impulsivity: 12, aggression: 10, composure: -10, sociability: 6 },
}

/** Typical temperament for each type, used to guess a canon character's type
 *  when the series never said. */
const TYPE_PROFILE: Record<NenType, Partial<Record<Facet, number>>> = {
  0: { honesty: 75, impulsivity: 65, bravery: 70, whimsy: 40 },
  1: { honesty: 30, whimsy: 75, loyalty: 40 },
  2: { discipline: 75, whimsy: 25, composure: 40 },
  3: { curiosity: 70, sociability: 35, ambition: 70, pride: 70 },
  4: { discipline: 65, empathy: 35, composure: 70, impulsivity: 30 },
  5: { impulsivity: 70, aggression: 65, composure: 35 },
}

export function randomFacets(r: Rng, type: NenType | null, bias: Partial<Record<Facet, number>> = {}): Record<Facet, number> {
  const o = {} as Record<Facet, number>
  const lean = type == null ? {} : TYPE_LEAN[type]
  for (const f of FACETS) {
    o[f] = r.trait(50 + (lean[f] || 0) + (bias[f] || 0), 17)
  }
  return o
}

export function randomValues(r: Rng, bias: Partial<Record<Value, number>> = {}): Record<Value, number> {
  const o = {} as Record<Value, number>
  for (const v of VALUES) o[v] = r.trait(bias[v] || 0, 18, -50, 50)
  return o
}

export function inferType(r: Rng, f: Record<Facet, number>): NenType {
  let best: NenType = 0, bs = -1e9
  for (let t = 0; t < 6; t++) {
    const prof = TYPE_PROFILE[t as NenType]
    let s = 0
    for (const k of Object.keys(prof) as Facet[]) s -= Math.abs((prof[k] || 50) - f[k])
    // Specialists are rare: about one in thirty.
    if (t === 3) s -= 40
    s += r.next() * 25
    if (s > bs) { bs = s; best = t as NenType }
  }
  return best
}

/** Weighted toward the canon spread: lots of Enhancers and Emitters, few Specialists. */
export function randomType(r: Rng): NenType {
  const w = [0.25, 0.18, 0.16, 0.035, 0.155, 0.22]
  let x = r.next()
  for (let i = 0; i < 6; i++) {
    x -= w[i]
    if (x < 0) return i as NenType
  }
  return 0
}

export function randomOrientation(r: Rng): 'straight' | 'gay' | 'bi' | 'ace' {
  const x = r.next()
  return x < 0.8 ? 'straight' : x < 0.88 ? 'bi' : x < 0.95 ? 'gay' : 'ace'
}

/** How well two people get along on temperament and values alone, -1..1. */
export function compatibility(a: { facets: Record<Facet, number>; values: Record<Value, number> }, b: { facets: Record<Facet, number>; values: Record<Value, number> }): number {
  let v = 0
  for (const k of VALUES) {
    const x = a.values[k], y = b.values[k]
    // Strongly held values that agree bond people; ones that clash divide them.
    if (Math.abs(x) > 15 && Math.abs(y) > 15) v += (Math.sign(x) === Math.sign(y) ? 1 : -1.2) * Math.min(Math.abs(x), Math.abs(y)) / 50
  }
  v /= 4
  const fa = a.facets, fb = b.facets
  // Liars and the honest grate on each other; two cruel people get along fine;
  // the gentle find the violent hard to be around.
  v -= Math.abs(fa.honesty - fb.honesty) / 400
  v -= Math.max(0, fa.empathy - 60) * Math.max(0, fb.cruelty - 55) / 2500
  v -= Math.max(0, fb.empathy - 60) * Math.max(0, fa.cruelty - 55) / 2500
  v += (fa.sociability + fb.sociability - 100) / 600
  v += (100 - Math.abs(fa.whimsy - fb.whimsy)) / 1000
  return Math.max(-1, Math.min(1, v))
}
