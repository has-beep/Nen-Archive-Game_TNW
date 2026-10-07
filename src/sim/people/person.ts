/**
 * People: construction and the derived numbers every system reads (health,
 * aura, combat power). Keeping the formulas here, and only here, is what
 * stops balance from drifting between the fight engine, the sheet and the AI.
 */
import { ATTRS, FACETS, MINDS, NEEDS, SKILLS, TECHS, VALUES, efficiency } from '../constants'
import type { Attr, Facet, MindAttr, Need, NenType, Skill, Tech, Value } from '../constants'
import type { Id, NenState, Person, Rel, World } from '../types'
import { ageAt } from '../time'

export function emptyTech(): Record<Tech, number> {
  const o = {} as Record<Tech, number>
  for (const t of TECHS) o[t] = 0
  return o
}
export function emptySkills(): Record<Skill, number> {
  const o = {} as Record<Skill, number>
  for (const s of SKILLS) o[s] = 0
  return o
}
export function fullNeeds(): Record<Need, number> {
  const o = {} as Record<Need, number>
  for (const n of NEEDS) o[n] = 70
  return o
}

export function newNen(type: NenType, pot: number, cap: number): NenState {
  return { awake: false, type, known: false, pot, cap, lvl: 0, aura: 1, tech: emptyTech(), enR: 0, cat: [0, 0, 0, 0, 0, 0], hatsu: [], stolen: [], vows: [], lifeSpent: 0 }
}

export interface PersonInit {
  name: string
  short?: string
  sex: 'm' | 'f'
  born: number
  home: Id
  loc?: Id
  nation: Id
  role: string
  attrs: Record<Attr, number>
  mind: Record<MindAttr, number>
  facets: Record<Facet, number>
  values: Record<Value, number>
  nen: NenState
  species?: Person['species']
  canon?: boolean
  key?: string
}

export function makePerson(w: World, o: PersonInit): Person {
  const p: Person = {
    id: w.people.length,
    key: o.key,
    name: o.name,
    short: o.short || o.name.split(' ')[0],
    sex: o.sex,
    species: o.species || 'human',
    born: o.born,
    alive: true,
    home: o.home,
    loc: o.loc ?? o.home,
    nation: o.nation,
    orgs: [],
    role: o.role,
    canon: !!o.canon,
    major: false,
    look: { skin: 0, hair: 0, style: 0, eyes: 0, height: 170 },
    attrs: o.attrs,
    mind: o.mind,
    facets: o.facets,
    values: o.values,
    orient: 'straight',
    needs: fullNeeds(),
    needW: needWeights(o.facets, o.values),
    mood: { happy: 55, stress: 15, fear: 0, anger: 0, grief: 0 },
    memories: [],
    dreams: [],
    plan: null,
    act: { k: 'idle', until: 0 },
    nextThink: 0,
    skills: emptySkills(),
    hp: 1,
    stam: 100,
    wounds: [],
    conds: [],
    nen: o.nen,
    jenny: 1,
    items: [],
    weapon: 'fists',
    fame: 0,
    infamy: 0,
    bounty: 0,
    rel: {},
    know: {},
    seen: {},
    stats: { wins: 0, losses: 0, kills: 0, fights: 0, spared: 0, saved: 0 },
    life: [],
    flags: {},
    lastFight: -999,
    span: 72,
  }
  w.people.push(p)
  p.hp = hpMax(p)
  return p
}

/**
 * How much each need matters to someone, read off their personality. A
 * fearless, violent person needs fights; a curious one needs to learn and
 * travel; a loyal one needs a cause. Weights run 0..3.
 */
export function needWeights(f: Record<Facet, number>, v: Record<Value, number>): Record<Need, number> {
  const c = (x: number) => Math.max(0, Math.min(3, x))
  return {
    rest: 1,
    social: c(0.2 + f.sociability / 45),
    family: c(0.1 + Math.max(0, v.family) / 22),
    romance: c(f.romantic / 45),
    fight: c((f.aggression - 30) / 25 + Math.max(0, v.strength) / 30 + (f.bravery - 50) / 60),
    train: c(0.3 + f.ambition / 50 + Math.max(0, v.strength) / 35),
    learn: c(0.1 + f.curiosity / 45 + Math.max(0, v.knowledge) / 35),
    wealth: c(f.greed / 40 + Math.max(0, v.wealth) / 30),
    adventure: c((f.curiosity - 30) / 35 + f.whimsy / 80 + Math.max(0, v.freedom) / 40),
    purpose: c(0.2 + f.loyalty / 50 + Math.max(0, v.tradition) / 50),
    fame: c((f.pride - 30) / 30),
    leisure: c(0.2 + f.whimsy / 50),
    justice: c(Math.max(0, v.law) / 30 + Math.max(0, v.honour) / 40 + (f.empathy - 50) / 60),
    solitude: c((60 - f.sociability) / 35),
  }
}

/* ---------------- Derived numbers ---------------- */

export function age(w: World, p: Person): number {
  return ageAt(p.born, w.t)
}

export function isAdult(w: World, p: Person): boolean {
  return p.species === 'ant' ? true : age(w, p) >= 18
}

/** Maximum health. Toughness and endurance matter most; aura adds a little
 *  (Ten keeps the body together); ants are built different. */
/** How much punishment a body takes. Aura is armour as much as weapon: a
 *  strong Nen user shrugs off blows that would kill anyone else, so the
 *  body's toughness grows with the square root of the aura they hold. */
export function hpMax(p: Person): number {
  const a = p.attrs
  const aura = p.nen.awake ? 3.6 * Math.sqrt(auraMax(p) / 14) : 0
  return Math.round(40 + a.tou * 0.75 + a.endu * 0.35 + p.nen.lvl * 0.25 + aura + (p.species === 'ant' ? 30 : 0))
}

/** Maximum aura, on the series' rough scale: about 21,000 at Nen level 50. */
export function auraMax(p: Person): number {
  if (!p.nen.awake) return 0
  return Math.round((100 + Math.pow(p.nen.lvl, 2.3) * 2.6) * (p.species === 'ant' ? 1.2 : 1))
}

/** Aura output per exchange in a fight. Ren unlocks most of it. */
export function auraOutput(p: Person): number {
  if (!nenUsable(p)) return 0
  const ren = p.nen.tech.ren / 100
  return Math.max(1, auraMax(p) / 14 * (0.35 + 0.65 * ren))
}

export function nenUsable(p: Person): boolean {
  if (!p.nen.awake || p.nen.burnedOut) return false
  for (const c of p.conds) if ((c.k === 'sealed' || c.k === 'debt') && c.until > 0) return false
  return true
}

export function eff(p: Person, cat: NenType): number {
  return efficiency(p.nen.type, cat)
}

/** Penalties from wounds, as multipliers. */
export function woundMods(p: Person): { atk: number; spd: number; acc: number; stam: number; worst: number; bleeding: boolean; open: number } {
  const m = { atk: 1, spd: 1, acc: 0, stam: 0, worst: 0, bleeding: false, open: 0 }
  for (const x of p.wounds) {
    const s = x.sev - 1
    const old = x.left <= 0
    const k = old ? 0.55 : 1
    if (!old) {
      if (x.sev > m.worst) m.worst = x.sev
      if (!x.treated) m.open = Math.max(m.open, x.sev)
      if (x.bleed && !x.treated) m.bleeding = true
    }
    switch (x.part) {
      case 'larm': case 'rarm': m.atk *= 1 - [0.07, 0.17, 0.33][s] * k; break
      case 'hand': m.atk *= 1 - [0.04, 0.11, 0.24][s] * k; break
      case 'lleg': case 'rleg': m.spd *= 1 - [0.1, 0.24, 0.45][s] * k; break
      case 'torso': m.stam += [8, 20, 35][s] * k; m.atk *= 1 - [0, 0.05, 0.14][s] * k; break
      case 'organs': m.stam += [10, 25, 45][s] * k; m.atk *= 1 - [0.03, 0.1, 0.2][s] * k; break
      case 'head': m.acc -= [0, 0.04, 0.1][s] * k; break
      case 'eye': m.acc -= [0.02, 0.06, 0.12][s] * k; break
    }
  }
  return m
}

/**
 * One number for how dangerous someone is right now, used by the AI to judge
 * fights before they happen and by the storyteller to rank people. It is not
 * what decides fights; the fight engine does that blow by blow.
 */
export function power(p: Person): number {
  const a = p.attrs
  const phys = (a.str * 0.35 + a.agi * 0.3 + a.refl * 0.2 + a.tou * 0.15) * 0.55
  const skill = Math.max(p.skills.unarmed, p.skills.blades, p.skills.firearms * 0.6, p.skills.thrown * 0.8, p.skills.assassination * 0.9) * 0.25
  let nen = 0
  if (nenUsable(p)) {
    nen = p.nen.lvl * 1.05 + (p.nen.tech.ken + p.nen.tech.ko + p.nen.tech.ryu) * 0.04
    const hs = p.nen.hatsu.length + p.nen.stolen.length
    nen *= 1 + Math.min(0.35, hs * 0.08)
  }
  const wm = woundMods(p)
  const health = 0.45 + 0.55 * Math.max(0, p.hp) / hpMax(p)
  return Math.max(1, (phys + skill + nen) * wm.atk * health * (p.species === 'ant' ? 1.1 : 1))
}

/** A Nen level a non-awakened person "counts as" when the AI sizes them up. */
export function threat(p: Person): number {
  return power(p)
}

/* ---------------- Relationships (raw access) ---------------- */

export function rel(a: Person, b: Id): Rel | undefined {
  return a.rel[b]
}

export function relOrNew(w: World, a: Person, b: Id): Rel {
  let r = a.rel[b]
  if (!r) {
    r = { aff: 0, trust: 0, resp: 0, fear: 0, attr: 0, fam: 0, debt: 0, bonds: 0, t0: w.t, t: w.t }
    a.rel[b] = r
  }
  return r
}

export function aff(a: Person, b: Id): number {
  return a.rel[b]?.aff ?? 0
}

/* ---------------- Facet helpers ---------------- */

export function facetsFrom(partial: Partial<Record<Facet, number>>, fill: (f: Facet) => number): Record<Facet, number> {
  const o = {} as Record<Facet, number>
  for (const f of FACETS) o[f] = partial[f] ?? fill(f)
  return o
}
export function valuesFrom(partial: Partial<Record<Value, number>>, fill: (v: Value) => number): Record<Value, number> {
  const o = {} as Record<Value, number>
  for (const v of VALUES) o[v] = partial[v] ?? fill(v)
  return o
}
export function attrsFrom(arr: number[]): Record<Attr, number> {
  const o = {} as Record<Attr, number>
  ATTRS.forEach((k, i) => (o[k] = arr[i]))
  return o
}
export function mindFrom(arr: number[]): Record<MindAttr, number> {
  const o = {} as Record<MindAttr, number>
  MINDS.forEach((k, i) => (o[k] = arr[i]))
  return o
}

export function person(w: World, id: Id | undefined | null): Person | undefined {
  return id == null ? undefined : w.people[id]
}

export function orgRank(p: Person, org: Id): number {
  const m = p.orgs.find((x) => x.org === org)
  return m ? m.rank : -1
}

export function inOrg(p: Person, org: Id): boolean {
  return p.orgs.some((x) => x.org === org)
}

export function hasCond(p: Person, k: string): boolean {
  return p.conds.some((c) => c.k === k)
}

export function condOf(p: Person, k: string) {
  return p.conds.find((c) => c.k === k)
}

export function isFree(p: Person): boolean {
  return p.alive && !p.trip && !p.conds.some((c) => c.k === 'jailed' || c.k === 'captive' || c.k === 'unconscious' || c.k === 'controlled')
}
