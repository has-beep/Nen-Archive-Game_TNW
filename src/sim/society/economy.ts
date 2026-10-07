/**
 * Money and work: wages, living costs, contracts (killings, bounties,
 * bodyguard work, retrievals), and things worth owning.
 *
 * All sums are in millions of Jenny. A Zoldyck contract runs to hundreds of
 * millions; a copy of Greed Island costs 5,800 million; a Hunter licence, if
 * you were foolish enough to sell one, would keep you comfortable for life.
 */
import { L, O, P, log } from '../history'
import type { Contract, Id, Item, Person, World } from '../types'
import { ROLES } from '../constants'
import { rng } from '../world'

export interface PostContract {
  k: Contract['k']
  client: number
  target?: Id
  reward: number
  why?: string
  place?: Id
  days?: number
  cause?: Id
}

export function postContract(w: World, c: PostContract): Contract {
  const existing = w.contracts.find((x) => (x.status === 'open' || x.status === 'taken') && x.k === c.k && x.target === c.target && x.client === c.client)
  if (existing) { existing.reward = Math.max(existing.reward, c.reward); return existing }
  const k: Contract = {
    id: w.contracts.length ? w.contracts[w.contracts.length - 1].id + 1 : 1,
    k: c.k, client: c.client, target: c.target, place: c.place, reward: Math.round(c.reward), posted: w.t, expires: w.t + (c.days || 120),
    status: 'open', ev: c.cause, why: c.why,
  }
  w.contracts.push(k)
  return k
}

export function clientName(w: World, c: Contract): string {
  if (c.client < 0) return O(w.orgs[-c.client - 1])
  return P(w.people[c.client])
}

export function payContract(w: World, c: Contract, to: Person, ev?: Id) {
  c.status = 'done'
  to.jenny += c.reward
  if (c.client < 0) w.orgs[-c.client - 1].treasury -= c.reward
  else w.people[c.client].jenny -= c.reward
  to.fame += 1 + c.reward / 100
  if (to.major || c.reward > 150) log(w, { type: 'job', imp: to.major ? 2 : 1, who: [to.id], cause: ev, text: `${P(to)} collects ${Math.round(c.reward)} million Jenny from ${clientName(w, c)}.` })
}

export function contractsTick(w: World) {
  for (const c of w.contracts) {
    if ((c.status === 'open' || c.status === 'taken') && w.t > c.expires) c.status = 'void'
  }
  if (w.contracts.length > 600) w.contracts = w.contracts.filter((c) => c.status === 'open' || c.status === 'taken' || w.t - c.posted < 400)
}

/** Open contracts this person could take, given who they are. */
export function contractsFor(w: World, p: Person): Contract[] {
  const out: Contract[] = []
  // People who run things do not take jobs off the board.
  if (['chairman', 'prince', 'royal', 'ruler', 'don', 'politician', 'child'].includes(p.role) || w.orgs.some((o) => o.leader === p.id)) return out
  // Zoldycks take work through the family; the Troupe takes what it wants;
  // the Ants do not read notice boards.
  if (p.orgs.some((m) => ['zoldyck', 'troupe', 'ants', 'bombers'].includes(w.orgs[m.org].key))) return out
  for (const c of w.contracts) {
    if (c.status !== 'open') continue
    const t = c.target != null ? w.people[c.target] : null
    if (t && (!t.alive || t === p)) continue
    if (c.client === p.id) continue
    if (t && (p.rel[t.id]?.aff ?? 0) > 15) continue
    if (c.k === 'assassination') {
      if (p.facets.cruelty < 45 && p.role !== 'assassin') continue
      if (t && (p.rel[t.id]?.aff ?? 0) > 20) continue
      if (p.orgs.some((m) => w.orgs[m.org].key === 'zoldyck')) continue
    }
    if (c.k === 'bounty' && !(p.license || p.role === 'mercenary' || p.facets.greed > 60)) continue
    if (c.k === 'bodyguard' && (p.nen.lvl < 20 || p.orgs.some((m) => ['troupe', 'zoldyck', 'ants'].includes(w.orgs[m.org].key)))) continue
    if (t && t.orgs.some((m) => p.orgs.some((n) => n.org === m.org))) continue
    out.push(c)
  }
  return out
}

/** Daily wages and living costs. */
export function earn(w: World, p: Person, days = 1) {
  const pay = (ROLES[p.role]?.pay ?? 0.02) * days
  p.jenny += pay * (0.7 + p.skills.negotiation / 200)
  for (const m of p.orgs) w.orgs[m.org].treasury += pay * 0.15
}

export function livingCost(p: Person, days = 1): number {
  return (0.008 + Math.max(0, p.facets.greed - 50) / 5000 + (p.role === 'prince' || p.role === 'don' || p.role === 'ruler' ? 0.15 : 0)) * days
}

/* ================= Items ================= */

export function makeItem(w: World, k: string, name: string, holder: Id, value: number, data?: Record<string, unknown>, place?: Id): Item {
  const it: Item = { id: w.items.length, k, name, holder, value, data, place }
  w.items.push(it)
  if (holder >= 0) w.people[holder].items.push(it.id)
  return it
}

export function giveItem(w: World, it: Item, to: Person | null, place?: Id) {
  if (it.holder >= 0) {
    const h = w.people[it.holder]
    h.items = h.items.filter((x) => x !== it.id)
  }
  it.holder = to ? to.id : -1
  it.place = to ? undefined : place
  if (to) to.items.push(it.id)
}

export function itemsOfKind(w: World, k: string): Item[] {
  return w.items.filter((i) => i.k === k)
}

/** Gambling, for those who like it more than they should. */
export function gamble(w: World, p: Person): number {
  const r = rng(w)
  const stake = Math.max(0.01, Math.min(p.jenny * 0.1, 5))
  const edge = (p.skills.gambling - 50) / 400
  const win = r.chance(0.47 + edge)
  const d = win ? stake * (0.8 + r.next()) : -stake
  p.jenny += d
  return d
}

export { L }
