/**
 * Getting from one place to another. Airships are the fast way and cost
 * money, unless you hold a Hunter licence, which makes public transport
 * free. Ships are slower and cheaper. Greed Island is not reached by sea at
 * all: you enter through a game console, and only a Nen user can. Nobody
 * reaches the Dark Continent without an expedition, or a death wish.
 */
import { L, P, log } from '../history'
import type { Id, Person, Trip, World } from '../types'
import { placeK, touch } from '../world'

const AIR_KM = 2600, SEA_KM = 900, LAND_KM = 450, WING_KM = 1400

export function km(w: World, a: Id, b: Id): number {
  const A = w.places[a], B = w.places[b]
  return Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2) * 250
}

export interface Route {
  days: number
  mode: Trip['mode']
  cost: number
  ok: boolean
  why?: string
}

export function route(w: World, p: Person, to: Id): Route {
  const from = p.loc
  const A = w.places[from], B = w.places[to]
  const d = km(w, from, to)
  if (B.features.includes('dc')) {
    if (!p.flags.expedition) return { days: 0, mode: 'sea', cost: 0, ok: false, why: 'The Dark Continent is closed by treaty.' }
    return { days: Math.max(20, Math.ceil(d / SEA_KM)), mode: 'sea', cost: 0, ok: true }
  }
  if (B.features.includes('game')) {
    if (!p.nen.awake) return { days: 0, mode: 'warp', cost: 0, ok: false, why: 'Only Nen users can enter Greed Island.' }
    if (!p.flags.giAccess) return { days: 0, mode: 'warp', cost: 0, ok: false, why: 'No copy of Greed Island to enter through.' }
    return { days: 1, mode: 'warp', cost: 0, ok: true }
  }
  if (A.features.includes('game')) {
    return { days: 1, mode: 'warp', cost: 0, ok: true }
  }
  if (p.species === 'ant') return { days: Math.max(1, Math.ceil(d / WING_KM)), mode: 'wing', cost: 0, ok: true }
  const licensed = !!p.license
  const airCost = licensed ? 0 : 0.008 * d / 1000
  const canFly = A.airport && B.airport && (licensed || p.jenny >= airCost || p.orgs.length > 0)
  if (canFly) return { days: Math.max(1, Math.ceil(d / AIR_KM)), mode: 'air', cost: p.orgs.length > 0 && !licensed ? airCost * 0.3 : airCost, ok: true }
  if (d < 900) return { days: Math.max(1, Math.ceil(d / LAND_KM)), mode: 'land', cost: 0, ok: true }
  return { days: Math.max(1, Math.ceil(d / SEA_KM)), mode: 'sea', cost: licensed ? 0 : 0.002 * d / 1000, ok: true }
}

export function travel(w: World, p: Person, to: Id, quiet = false): boolean {
  if (to === p.loc || p.trip) return false
  const rt = route(w, p, to)
  if (!rt.ok) return false
  p.jenny -= rt.cost
  const from = p.loc
  if (w.places[to].features.includes('game')) p.flags.giReturn = from
  p.trip = { from, to, t0: w.t, t1: w.t + rt.days, mode: rt.mode }
  p.loc = to
  touch(w, p)
  if (!quiet && (p.owned || (p.major && rt.days >= 2))) {
    log(w, {
      type: 'move', imp: 0, who: [p.id], at: to,
      text: `${P(p)} leaves ${L(w.places[from])} for ${L(w.places[to])}, ${Math.round(km(w, from, to)).toLocaleString('en-US')} km, ${rt.days} ${rt.days === 1 ? 'day' : 'days'} ${modeWord(rt.mode)}.`,
    })
  }
  return true
}

export function modeWord(m: Trip['mode']): string {
  return m === 'air' ? 'by airship' : m === 'sea' ? 'by ship' : m === 'land' ? 'over land' : m === 'wing' ? 'on the wing' : 'through the game console'
}

/** Arrivals, once a day. */
export function arrive(w: World, p: Person) {
  if (!p.trip || w.t < p.trip.t1) return
  const tr = p.trip
  p.trip = undefined
  touch(w, p)
  if (p.owned && tr.t1 - tr.t0 > 1) log(w, { type: 'arrive', imp: 0, who: [p.id], at: p.loc, text: `${P(p)} arrives in ${L(w.places[p.loc])}.` })
}

/** Leaving Greed Island puts you back where you entered from. */
export function leaveGame(w: World, p: Person) {
  const back = (p.flags.giReturn as number | undefined) ?? placeK(w, 'yorknew').id
  travel(w, p, back, true)
}
