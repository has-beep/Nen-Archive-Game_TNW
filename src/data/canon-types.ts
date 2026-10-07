import type { DreamKind, HatsuSpec, HatsuCond } from '../sim/types'
import type { Facet, Value, Skill, Tech } from '../sim/constants'

/**
 * How a canon character is written down. Compact on purpose: there are well
 * over a hundred of them. Anything left out is generated around the series'
 * own folk theory (Nen type shapes personality) with a little noise.
 */
export interface CanonDef {
  key: string
  name: string
  short?: string
  sex: 'm' | 'f'
  /** Birth year, or [year, month(1-12), day]. */
  born: number | [number, number, number]
  species?: 'human' | 'ant'
  home: string
  loc?: string
  nation: string
  /** Index in hex order: 0 Enh, 1 Tra, 2 Con, 3 Spe, 4 Man, 5 Emi. -1 unknown (generated). */
  type: number
  /** Nen level at the start. 0 with awake false means no Nen yet. */
  lvl: number
  awake?: boolean
  /** Talent, ~0.2..1.8 */
  pot: number
  cap: number
  /** [str, agi, tou, endu, refl, senses] */
  body: [number, number, number, number, number, number]
  /** [int, will, focus, intuition, charisma] */
  mind: [number, number, number, number, number]
  p: Partial<Record<Facet, number>>
  v?: Partial<Record<Value, number>>
  dreams?: [DreamKind, string | null, number, string?][]
  skills?: Partial<Record<Skill, number>>
  orgs?: [string, number, { num?: number; title?: string; secret?: boolean; loyalty?: number }?][]
  role: string
  title?: string
  weapon?: string
  jenny?: number
  fame?: number
  infamy?: number
  /** [other key, bonds ("friend,rival"), affection, trust?, respect?, fear?] */
  rel?: [string, string, number, number?, number?, number?][]
  hatsu?: HatsuSpec[]
  destined?: HatsuSpec[]
  tech?: Partial<Record<Tech, number>>
  major?: boolean
  span?: number
  orient?: 'straight' | 'gay' | 'bi' | 'ace'
  license?: { stars: number; field?: string; year?: number }
  items?: string[]
  /** Not present at the start: born or created by a later event. */
  appears?: 'ants' | 'later'
  enR?: number
  bio: string
}

export type { HatsuSpec, HatsuCond }
