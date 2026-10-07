/**
 * The player's own people: making an original character, and taking
 * charge of an existing one.
 *
 * An original character starts like every Phase 4 run on the Nen Archive:
 * young, unknown, and with Nen locked until they earn it. Higher tiers can
 * start with more (an awakened character, more talent), but nobody starts
 * strong. A character can also arrive from the Archive with their sheet
 * (Nen type, personality, a designed Hatsu waiting to be learned).
 */
import { FACETS, VALUES, type Facet, type NenType, type Value } from '../constants'
import { L, P, log } from '../history'
import type { DreamKind, HatsuSpec, Id, Person, World } from '../types'
import { personK, rng } from '../world'
import { spawn } from '../worldgen/spawn'
import { tierInfo } from './player'
import { remember } from '../people/memory'

export interface CharacterSpec {
  name: string
  sex: 'm' | 'f'
  age: number
  /** 0..5, or -1 to let water divination decide. */
  type: NenType | -1
  home: Id
  role: 'drifter' | 'student' | 'fighter' | 'rookie' | 'thief' | 'scholar' | 'doctor' | 'merchant' | 'mercenary' | 'civilian'
  /** -40..40 nudges on the personality the type would give them. */
  facets?: Partial<Record<Facet, number>>
  values?: Partial<Record<Value, number>>
  /** Up to three wants. Targets are person keys or ids where needed. */
  dreams?: { k: DreamKind; target?: Id; tag?: string }[]
  talent?: 'ordinary' | 'gifted' | 'prodigy'
  awakened?: boolean
  bio?: string
  /** A Hatsu designed on the Archive's builder, waiting for them to be ready. */
  hatsu?: HatsuSpec
}

const TALENT = { ordinary: [0.6, 0.9], gifted: [0.95, 1.25], prodigy: [1.3, 1.6] } as const

export function createCharacter(w: World, s: CharacterSpec): { ok: boolean; msg: string; id?: Id } {
  const t = tierInfo(w)
  if (w.player.owned.filter((id) => w.people[id]?.alive).length >= t.owned) return { ok: false, msg: `Your tier allows ${t.owned} character${t.owned === 1 ? '' : 's'} at a time.` }
  const r = rng(w)
  const talent = s.talent === 'prodigy' && w.player.tier !== 'coffee' ? 'gifted' : s.talent || 'ordinary'
  const awake = !!s.awakened && w.player.tier === 'coffee'
  const place = w.places[s.home] && w.places[s.home].kind !== 'beyond' && !w.places[s.home].features.includes('game') ? s.home : personK(w, 'gon_freecss')?.home ?? 0
  const p = spawn(w, {
    role: s.role, place, name: String(s.name || '').replace(/[{}<>]/g, '').slice(0, 40) || undefined, sex: s.sex,
    age: [Math.max(12, Math.min(60, s.age | 0)), Math.max(12, Math.min(60, s.age | 0))],
    type: s.type >= 0 ? (s.type as NenType) : undefined, pot: [...TALENT[talent]] as [number, number],
    lvl: awake ? [14, 20] : [0, 6], awake, noHatsu: true, bias: clampMap(s.facets, 40), vbias: clampMap(s.values, 40),
  })
  p.owned = true
  p.major = true
  p.bio = s.bio ? String(s.bio).slice(0, 500) : undefined
  p.nen.known = s.type >= 0
  if (s.dreams?.length) {
    p.dreams = []
    for (const d of s.dreams.slice(0, 3)) p.dreams.push({ k: d.k, target: d.target, tag: d.tag, pri: 80 - p.dreams.length * 10, prog: 0, since: w.t })
  }
  if (s.hatsu) {
    const spec = { ...s.hatsu, at: Math.max(30, s.hatsu.at ?? 34) }
    p.nen.destined = [spec]
    p.flags.fixedHatsu = 1
  }
  w.player.owned.push(p.id)
  w.player.follow = p.id
  const ev = log(w, { type: 'misc', imp: 3, who: [p.id], at: p.loc, text: `${P(p)} sets out from ${L(w.places[p.loc])}. Nobody has heard of them yet.` })
  remember(w, p, { k: 'start', val: 30, str: 60, ev, text: 'Left home to find my own way.' })
  void r
  return { ok: true, msg: `${p.name} enters the world.`, id: p.id }
}

/** Take charge of someone already in the world: their crossroads come to
 *  you. Canon characters count against the same limit. */
export function own(w: World, id: Id): { ok: boolean; msg: string } {
  const p = w.people[id]
  if (!p?.alive) return { ok: false, msg: 'They are not alive.' }
  if (p.owned) return { ok: true, msg: `${p.short} is already yours.` }
  const t = tierInfo(w)
  if (w.player.owned.filter((x) => w.people[x]?.alive).length >= t.owned) return { ok: false, msg: `Your tier allows ${t.owned} character${t.owned === 1 ? '' : 's'} at a time. Release one first.` }
  p.owned = true
  w.player.owned.push(p.id)
  w.player.follow = p.id
  return { ok: true, msg: `You now guide ${p.name}. Their choices at a crossroads are yours.` }
}

export function release(w: World, id: Id): { ok: boolean; msg: string } {
  const p = w.people[id]
  if (!p) return { ok: false, msg: 'No such person.' }
  p.owned = false
  w.player.owned = w.player.owned.filter((x) => x !== id)
  for (const c of w.player.crossroads) if (c.pid === id && !c.chosen) c.chosen = 'released'
  return { ok: true, msg: `${p.short} goes their own way.` }
}

function clampMap<K extends string>(m: Partial<Record<K, number>> | undefined, lim: number): Partial<Record<K, number>> | undefined {
  if (!m) return undefined
  const out: Partial<Record<K, number>> = {}
  for (const k in m) out[k] = Math.max(-lim, Math.min(lim, Number(m[k]) || 0))
  return out
}

export const CREATOR_ROLES: CharacterSpec['role'][] = ['drifter', 'student', 'fighter', 'thief', 'scholar', 'doctor', 'merchant', 'mercenary', 'civilian']
export const CREATOR_FACETS: Facet[] = FACETS.slice() as Facet[]
export const CREATOR_VALUES: Value[] = VALUES.slice() as Value[]
export type { Person }
