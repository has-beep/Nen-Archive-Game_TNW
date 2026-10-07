/**
 * Runtime helpers around the plain World data: the random stream, key
 * lookups, and a per-tick index of who is where. The index lives in a
 * WeakMap rather than on the world, so it is never saved and never stale
 * after a load.
 */
import { Rng } from './rng'
import type { Id, Nation, Org, Person, Place, World } from './types'

interface Index {
  t: number
  dirty: boolean
  at: Map<Id, Person[]>
  alive: Person[]
  placeKey: Map<string, Place>
  orgKey: Map<string, Org>
  nationKey: Map<string, Nation>
  personKey: Map<string, Person>
  members: Map<Id, Person[]>
}

const RNG = new WeakMap<World, Rng>()
const IDX = new WeakMap<World, Index>()

export function rng(w: World): Rng {
  let r = RNG.get(w)
  if (!r || r.s !== w.rng) {
    r = new Rng(w.rng)
    RNG.set(w, r)
  }
  return r
}

function idx(w: World): Index {
  let i = IDX.get(w)
  if (!i) {
    i = {
      t: -1, dirty: true, at: new Map(), alive: [], members: new Map(),
      placeKey: new Map(w.places.map((p) => [p.key, p])),
      orgKey: new Map(w.orgs.map((o) => [o.key, o])),
      nationKey: new Map(w.nations.map((n) => [n.key, n])),
      personKey: new Map(),
    }
    for (const p of w.people) if (p.key) i.personKey.set(p.key, p)
    IDX.set(w, i)
  }
  if (i.dirty || i.t !== w.t) rebuild(w, i)
  return i
}

function rebuild(w: World, i: Index) {
  i.at.clear()
  i.members.clear()
  i.alive = []
  for (const p of w.people) {
    if (!p.alive) continue
    i.alive.push(p)
    if (!p.trip) {
      let l = i.at.get(p.loc)
      if (!l) i.at.set(p.loc, (l = []))
      l.push(p)
    }
    for (const m of p.orgs) {
      let l = i.members.get(m.org)
      if (!l) i.members.set(m.org, (l = []))
      l.push(p)
    }
  }
  i.dirty = false
  i.t = w.t
}

/** Call after anything that changes who is where, who is alive, or who
 *  belongs to what. */
export function touch(w: World) {
  const i = IDX.get(w)
  if (i) i.dirty = true
}

/** Call after adding people, organisations, places or nations. */
export function reindex(w: World) {
  IDX.delete(w)
}

export function alive(w: World): Person[] {
  return idx(w).alive
}

/** People physically present at a place (not travelling through it). */
export function at(w: World, place: Id): Person[] {
  return idx(w).at.get(place) || EMPTY
}
const EMPTY: Person[] = []

/** Living members of an organisation. */
export function members(w: World, org: Id): Person[] {
  return idx(w).members.get(org) || EMPTY
}

export function placeK(w: World, key: string): Place {
  const p = idx(w).placeKey.get(key)
  if (!p) throw new Error('No place ' + key)
  return p
}
export function orgK(w: World, key: string): Org {
  const o = idx(w).orgKey.get(key)
  if (!o) throw new Error('No organisation ' + key)
  return o
}
export function nationK(w: World, key: string): Nation {
  const n = idx(w).nationKey.get(key)
  if (!n) throw new Error('No nation ' + key)
  return n
}
export function personK(w: World, key: string): Person | undefined {
  return idx(w).personKey.get(key)
}
export function registerKey(w: World, p: Person) {
  if (p.key) idx(w).personKey.set(p.key, p)
}

export function leaderOf(w: World, org: Org): Person | undefined {
  const p = w.people[org.leader]
  return p && p.alive ? p : undefined
}

export function dist(w: World, a: Id, b: Id): number {
  const A = w.places[a], B = w.places[b]
  const dx = A.x - B.x, dy = A.y - B.y
  return Math.sqrt(dx * dx + dy * dy) * 250
}

export function counter(w: World, k: string, n = 1): number {
  w.counters[k] = (w.counters[k] || 0) + n
  return w.counters[k]
}
