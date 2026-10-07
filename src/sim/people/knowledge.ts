/**
 * What people know.
 *
 * In this setting information decides more fights than aura does. The Troupe
 * spends Yorknew hunting "the chain user" because they do not know who he is;
 * a Hatsu whose conditions are known can be dodged; nobody can avenge a death
 * if they never learn who caused it. So people act on what they have heard,
 * not on what is true.
 *
 * Facts are shared records; each person holds the ids they know. Public facts
 * (a war, a famous death, the Exam results) are known to everyone without
 * being copied into every head. Whereabouts are tracked separately and more
 * cheaply, as "last seen at".
 */
import type { Fact, FactKind, Id, Person, World } from '../types'
import { rng } from '../world'

export interface FactInput {
  k: FactKind
  s: Id
  o?: Id
  d?: string
  truth?: boolean
  secret?: number
  imp?: number
  text: string
  ev?: Id
  /** Known to everyone. */
  pub?: boolean
}

export function addFact(w: World, f: FactInput): Fact {
  const fact: Fact = { id: w.nextFact++, k: f.k, s: f.s, o: f.o, d: f.d, t: w.t, truth: f.truth !== false, secret: f.pub ? -1 : (f.secret ?? 0.3), imp: f.imp ?? 1, text: f.text, ev: f.ev }
  w.facts.push(fact)
  return fact
}

/** Finds an existing fact of the same shape, so the same crime is not
 *  recorded twice. */
export function findFact(w: World, k: FactKind, s: Id, o?: Id, d?: string): Fact | undefined {
  for (let i = w.facts.length - 1; i >= 0; i--) {
    const f = w.facts[i]
    if (f.k === k && f.s === s && f.o === o && f.d === d) return f
  }
  return undefined
}

export function factById(w: World, id: Id): Fact | undefined {
  // Fact ids grow with the array, but pruning may remove some: search back.
  const arr = w.facts
  let lo = 0, hi = arr.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].id === id) return arr[mid]
    if (arr[mid].id < id) lo = mid + 1
    else hi = mid - 1
  }
  return undefined
}

export function knows(p: Person, f: Fact): boolean {
  return f.secret < 0 || p.know[f.id] != null || f.s === p.id
}

export function learn(w: World, p: Person, f: Fact): boolean {
  if (knows(p, f)) return false
  p.know[f.id] = w.t
  return true
}

/** Everyone at a place witnesses something. */
export function witness(w: World, f: Fact, people: Person[]) {
  for (const p of people) learn(w, p, f)
}

/** Does p know that s did k (to o)? */
export function knowsThat(w: World, p: Person, k: FactKind, s: Id, o?: Id): boolean {
  for (const id in p.know) {
    const f = factById(w, +id)
    if (f && f.k === k && f.s === s && (o == null || f.o === o) && f.truth) return true
  }
  return false
}

/** All facts p knows about subject s. */
export function factsAbout(w: World, p: Person, s: Id): Fact[] {
  const out: Fact[] = []
  for (const id in p.know) {
    const f = factById(w, +id)
    if (f && (f.s === s || f.o === s)) out.push(f)
  }
  return out
}

/** Who killed this person, as far as p knows. */
export function knownKiller(w: World, p: Person, victim: Id): Id | undefined {
  for (const id in p.know) {
    const f = factById(w, +id)
    if (f && f.k === 'crime' && f.d === 'kill' && f.o === victim && f.truth) return f.s
  }
  return undefined
}

/** Does p know this ability (so it loses its surprise against them)? */
export function knowsAbility(w: World, p: Person, owner: Id, hatsuId: string): boolean {
  for (const id in p.know) {
    const f = factById(w, +id)
    if (f && f.k === 'ability' && f.s === owner && f.d === hatsuId) return true
  }
  return false
}

export function abilityFact(w: World, owner: Person, hatsuId: string, name: string): Fact {
  return findFact(w, 'ability', owner.id, undefined, hatsuId) || addFact(w, { k: 'ability', s: owner.id, d: hatsuId, secret: 0.5, imp: 2, text: `${owner.name} can use ${name}.` })
}

/* ---------------- Whereabouts ---------------- */

export function see(w: World, p: Person, q: Person) {
  p.seen[q.id] = [q.loc, w.t]
}

/** Where p believes q is, and how old that belief is. */
export function whereIs(w: World, p: Person, q: Person): { place: Id; age: number } | null {
  if (p.loc === q.loc && !p.trip && !q.trip) return { place: q.loc, age: 0 }
  const s = p.seen[q.id]
  if (!s) return null
  return { place: s[0], age: w.t - s[1] }
}

/**
 * A day spent looking for someone. Hunters can search the Hunter website;
 * money buys information brokers; trackers read trails. Someone who hides
 * well, or keeps moving, or lives where no records are kept (Meteor City),
 * is harder to find.
 */
export function investigate(w: World, p: Person, q: Person): boolean {
  const r = rng(w)
  const skill = (p.skills.tracking + p.skills.perception + p.mind.int) / 300
  const access = (p.license ? 0.35 : 0) + Math.min(0.25, p.jenny / 400) + (p.orgs.length ? 0.1 : 0)
  const hide = (q.skills.stealth / 200 + (q.facets.discipline > 70 ? 0.1 : 0) + (w.places[q.loc].hidden ? 0.25 : 0) + (q.trip ? 0.2 : 0)) * (q.fame > 50 ? 0.6 : 1)
  const chance = Math.max(0.01, 0.06 + skill * 0.12 + access * 0.12 - hide * 0.12)
  if (r.chance(chance)) {
    p.seen[q.id] = [q.trip ? q.trip.to : q.loc, w.t]
    return true
  }
  return false
}

/* ---------------- Gossip ---------------- */

/**
 * During a conversation, a passes something on to b. What they choose to
 * share depends on how loose-lipped they are, how much it matters, and
 * whether b would care. Secrets that could hurt a's own group stay unsaid
 * unless a is disloyal.
 */
export function gossip(w: World, a: Person, b: Person): Fact | null {
  const r = rng(w)
  const ids = Object.keys(a.know)
  if (!ids.length) return null
  const loose = (a.facets.sociability + (100 - a.facets.discipline) + (100 - a.facets.loyalty)) / 300
  if (!r.chance(0.25 + loose * 0.5)) return null
  let best: Fact | null = null, bs = 0
  for (let i = 0; i < 6; i++) {
    const f = factById(w, +ids[r.int(ids.length)])
    if (!f || knows(b, f)) continue
    if (f.s === a.id && f.k !== 'ability') continue
    let s = f.imp * (0.5 + r.next())
    if (b.rel[f.s] || (f.o != null && b.rel[f.o])) s *= 2.2
    if (f.secret > 0.6) s *= loose * 0.6
    if (f.k === 'member' && a.orgs.some((m) => m.org === f.o) && a.facets.loyalty > 40) s = 0
    if (s > bs) { bs = s; best = f }
  }
  if (best) learn(w, b, best)
  return best
}

/** Facts about the dead, or that nobody holds any more, are dropped. */
export function pruneFacts(w: World) {
  if (w.facts.length < 6000) return
  const held = new Set<number>()
  for (const p of w.people) if (p.alive) for (const id in p.know) held.add(+id)
  w.facts = w.facts.filter((f) => f.secret < 0 || held.has(f.id) || f.imp >= 3)
  for (const p of w.people) {
    if (!p.alive) { p.know = {}; continue }
  }
}
