/**
 * History: an append-only record of what happened, who was there, and what
 * caused it. Following `cause` back from any event walks the chain that led
 * to it, which is the whole story without the game ever having to write one.
 *
 * Text carries tokens rather than names, so renaming or following someone
 * updates every line: {p12} a person, {o3} an organisation, {n2} a nation,
 * {l5} a place.
 */
import type { HistEvent, Id, World } from './types'

export const P = (p: { id: Id }) => `{p${p.id}}`
export const O = (o: { id: Id }) => `{o${o.id}}`
export const N = (n: { id: Id }) => `{n${n.id}}`
export const L = (l: { id: Id }) => `{l${l.id}}`

export interface LogInput {
  type: string
  imp: number
  text: string
  who?: Id[]
  at?: Id
  orgs?: Id[]
  nats?: Id[]
  cause?: Id
  story?: Id
  data?: Record<string, unknown>
}

export function log(w: World, o: LogInput): Id {
  const e: HistEvent = {
    id: w.nextEv++,
    t: w.t,
    type: o.type,
    imp: Math.max(0, Math.min(5, o.imp)),
    text: o.text,
    who: o.who ? Array.from(new Set(o.who)) : [],
    at: o.at,
    orgs: o.orgs,
    nats: o.nats,
    cause: o.cause,
    story: o.story,
    data: o.data,
  }
  // The storyteller raises the importance of anything touching people the
  // player cares about, so it reaches the chronicle and the headline.
  for (const id of e.who) {
    const p = w.people[id]
    if (!p) continue
    p.life.push(e.id)
    if (p.life.length > 260) p.life.splice(0, p.life.length - 260)
  }
  w.events.push(e)
  w.fresh.push(e.id)
  return e.id
}

/** Binary search: ids only ever increase, and pruning keeps order. */
export function eventById(w: World, id: Id | undefined): HistEvent | undefined {
  if (id == null) return undefined
  const ev = w.events
  let lo = 0, hi = ev.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const x = ev[mid].id
    if (x === id) return ev[mid]
    if (x < id) lo = mid + 1
    else hi = mid - 1
  }
  return undefined
}

/** The chain of causes behind an event, nearest first. */
export function causeChain(w: World, id: Id, max = 8): HistEvent[] {
  const out: HistEvent[] = []
  let e = eventById(w, eventById(w, id)?.cause)
  const seen = new Set<Id>()
  while (e && out.length < max && !seen.has(e.id)) {
    seen.add(e.id)
    out.push(e)
    e = eventById(w, e.cause)
  }
  return out
}

/**
 * Old trivia is forgotten so a long-running world stays small enough to save.
 * Anything of importance 2 or more is kept forever, along with every fight
 * and death, since those are what the legends browser is for.
 */
export function prune(w: World) {
  if (w.events.length < 30000) return
  const cutoff = w.t - 540
  const keep: HistEvent[] = []
  for (const e of w.events) {
    if (e.imp >= 2 || e.t >= cutoff || e.type === 'death' || e.type === 'fight') keep.push(e)
  }
  w.events = keep
  const alive = new Set(keep.map((e) => e.id))
  for (const p of w.people) p.life = p.life.filter((id) => alive.has(id))
}

/** Replaces tokens with plain names, for logs and the headless runner. */
export function plain(w: World, s: string): string {
  return s.replace(/\{([ponl])(\d+)\}/g, (_m, k: string, id: string) => {
    const i = +id
    if (k === 'p') return w.people[i]?.name ?? '?'
    if (k === 'o') return w.orgs[i]?.name ?? '?'
    if (k === 'n') return w.nations[i]?.name ?? '?'
    if (k === 'l') return w.places[i]?.name ?? '?'
    return '?'
  })
}
