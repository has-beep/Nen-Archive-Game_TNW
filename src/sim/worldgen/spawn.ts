/**
 * Making people who are not in the series: Hunters, mafiosi, soldiers,
 * masters, drifters, Exam hopefuls. Their temperament follows their Nen type
 * the way the series says it should, their skills follow their work, and
 * their wants follow both.
 */
import type { NenType } from '../constants'
import type { Id, Person, World } from '../types'
import { makePerson, newNen, attrsFrom, mindFrom } from '../people/person'
import { randomFacets, randomOrientation, randomType, randomValues } from '../people/traits'
import { seedDreams } from '../people/dreams'
import { develop } from '../nen/nen'
import { rng, registerKey, touch } from '../world'
import { TECHS, TECH_INFO } from '../constants'
import { FAMILY, GIVEN_F, GIVEN_M, JAPPON_FAMILY, JAPPON_GIVEN_F, JAPPON_GIVEN_M, KAKIN_FAMILY, KAKIN_GIVEN_F, KAKIN_GIVEN_M, METEOR_NAMES } from '../../data/names'
import { ROLE_WEAPONS } from '../../data/weapons'
import type { Facet, Skill, Value } from '../constants'
import type { Rng } from '../rng'

export interface SpawnOpts {
  role: string
  place: Id
  nation?: Id
  lvl?: [number, number]
  awake?: boolean
  age?: [number, number]
  sex?: 'm' | 'f'
  type?: NenType
  bias?: Partial<Record<Facet, number>>
  vbias?: Partial<Record<Value, number>>
  skills?: Partial<Record<Skill, number>>
  pot?: [number, number]
  jenny?: number
  noHatsu?: boolean
  name?: string
}

export function genName(w: World, r: Rng, sex: 'm' | 'f', nationKey: string, placeKey: string): string {
  const used = (w.flags.__names as Record<string, number>) || (w.flags.__names = {})
  for (let i = 0; i < 30; i++) {
    let n: string
    if (placeKey === 'meteor') n = r.pick(METEOR_NAMES) + (r.chance(0.3) ? ' ' + r.pick(METEOR_NAMES) : '')
    else if (nationKey === 'kakin') n = `${r.pick(KAKIN_FAMILY)} ${r.pick(sex === 'm' ? KAKIN_GIVEN_M : KAKIN_GIVEN_F)}`
    else if (nationKey === 'jappon') n = `${r.pick(sex === 'm' ? JAPPON_GIVEN_M : JAPPON_GIVEN_F)} ${r.pick(JAPPON_FAMILY)}`
    else n = `${r.pick(sex === 'm' ? GIVEN_M : GIVEN_F)} ${r.pick(FAMILY)}`
    if (!used[n]) { used[n] = 1; return n }
  }
  return `${r.pick(sex === 'm' ? GIVEN_M : GIVEN_F)} ${r.pick(FAMILY)} ${w.people.length}`
}

const ROLE_SKILLS: Record<string, Partial<Record<Skill, number>>> = {
  blacklist: { tracking: 60, unarmed: 55, perception: 55, firearms: 40 }, treasure: { scholarship: 55, survival: 55, perception: 50 },
  gourmet: { cooking: 70, survival: 50 }, beast: { tracking: 60, survival: 65, perception: 55 }, ruins: { scholarship: 65, survival: 50 },
  sea: { survival: 60, piloting: 50 }, jackpot: { negotiation: 65, gambling: 50 }, virus: { medicine: 70, scholarship: 60 },
  crime: { tracking: 55, strategy: 50 }, info: { scholarship: 55, deception: 45, negotiation: 50 }, contract: { negotiation: 60, strategy: 50 },
  rookie: { unarmed: 40, survival: 40 }, fighter: { unarmed: 65 }, master: { unarmed: 65, scholarship: 40 }, doctor: { medicine: 70, scholarship: 50 },
  merchant: { negotiation: 65, deception: 35 }, scholar: { scholarship: 75 }, thief: { stealth: 65, deception: 50 }, assassin: { assassination: 70, stealth: 70 },
  butler: { unarmed: 55, stealth: 45, perception: 50 }, mafioso: { firearms: 55, deception: 40 }, don: { negotiation: 65, leadership: 60 },
  guard: { firearms: 55, perception: 55, unarmed: 45 }, mercenary: { firearms: 65, survival: 45 }, soldier: { firearms: 55, survival: 40 },
  officer: { leadership: 60, strategy: 55, firearms: 55 }, criminal: { deception: 50, firearms: 40 }, poacher: { firearms: 55, tracking: 55 },
  politician: { negotiation: 70, deception: 50, leadership: 55 }, ruler: { leadership: 70, negotiation: 60 }, ninja: { stealth: 75, assassination: 50 },
  explorer: { survival: 70, tracking: 50 }, spy: { deception: 65, stealth: 55 }, gamer: { strategy: 45 },
}

export function spawn(w: World, o: SpawnOpts): Person {
  const r = rng(w)
  const place = w.places[o.place]
  const nation = o.nation ?? place.nation
  const nk = w.nations[nation]?.key || 'none'
  const sex = o.sex || (r.chance(0.6) ? 'm' : 'f')
  const type = o.type ?? randomType(r)
  const facets = randomFacets(r, type, o.bias)
  const values = randomValues(r, o.vbias)
  const [a0, a1] = o.age || [18, 50]
  const ageY = r.irange(a0, a1)
  const [l0, l1] = o.lvl || [0, 0]
  const lvl = l0 + r.next() * (l1 - l0)
  const awake = o.awake ?? lvl > 18
  const pot = o.pot ? r.range(o.pot[0], o.pot[1]) : Math.max(0.2, Math.min(1.6, 0.75 + r.gauss() * 0.28))
  const cap = Math.min(100, Math.max(lvl + 6, 35 + pot * 30 + r.next() * 25))
  const base = (m: number) => r.trait(m, 12, 10, 95)
  const fighting = /^(blacklist|fighter|assassin|thief|soldier|officer|mercenary|guard|butler|ninja|master)$/.test(o.role)
  const attrs = attrsFrom([base(fighting ? 58 : 42), base(fighting ? 58 : 44), base(fighting ? 56 : 42), base(fighting ? 56 : 45), base(fighting ? 56 : 44), base(48)])
  const mind = mindFrom([base(50), base(50), base(48), base(50), base(48)])
  const p = makePerson(w, {
    name: o.name || genName(w, r, sex, nk, place.key), sex, born: w.t - ageY * 365 - r.int(365), home: o.place, nation, role: o.role,
    attrs, mind, facets, values, nen: newNen(type, pot, Math.round(cap)),
  })
  p.orient = randomOrientation(r)
  p.span = 65 + r.int(30)
  p.look = { skin: r.int(5), hair: r.int(10), style: r.int(4), eyes: r.int(5), height: sex === 'm' ? 160 + r.int(30) : 152 + r.int(25) }
  p.jenny = o.jenny ?? Math.round((1 + r.next() * 20) * 10) / 10
  const sk = { ...(ROLE_SKILLS[o.role] || {}), ...(o.skills || {}) }
  for (const k in sk) p.skills[k as Skill] = r.trait(sk[k as Skill]!, 10, 0, 100)
  p.skills.unarmed = Math.max(p.skills.unarmed, r.trait(fighting ? 45 : 20, 12, 0, 90))
  p.skills.perception = Math.max(p.skills.perception, r.trait(35, 12, 0, 90))
  p.weapon = ROLE_WEAPONS[o.role] ? r.pick(ROLE_WEAPONS[o.role]) : 'fists'
  if (awake) {
    p.nen.awake = true
    p.nen.how = 'slow'
    p.nen.lvl = lvl
    p.nen.known = lvl > 25
    for (const t of TECHS) {
      const req = TECH_INFO[t].req
      if (lvl >= req) p.nen.tech[t] = Math.round(Math.min(100, 20 + (lvl - req) * 1.6 + r.next() * 15))
    }
    p.nen.enR = p.nen.tech.en ? Math.round(p.nen.tech.en / 100 * (8 + lvl * 0.4)) : 0
    p.nen.cat[type] = Math.min(100, lvl * 1.1)
    if (!o.noHatsu && lvl >= 34 && p.nen.tech.hatsu >= 20) {
      develop(w, p, { quiet: true })
      if (lvl > 72 && r.chance(0.35)) develop(w, p, { quiet: true })
    }
  } else {
    p.nen.lvl = Math.min(18, lvl)
  }
  p.memories = []
  seedDreams(w, p)
  touch(w)
  registerKey(w, p)
  return p
}

/** A stranger who turns up for the Hunter Exam. */
export function spawnCandidate(w: World, place: Id): Person {
  const r = rng(w)
  const kinds = ['drifter', 'fighter', 'criminal', 'ninja', 'drifter', 'scholar', 'mercenary']
  const role = r.pick(kinds)
  const p = spawn(w, { role, place, age: [14, 40], lvl: [0, role === 'fighter' || role === 'ninja' ? 30 : 16], bias: { ambition: 15, bravery: 10 }, awake: r.chance(0.12) })
  if (!p.dreams.some((d) => d.k === 'hunter')) p.dreams.unshift({ k: 'hunter', pri: 70, prog: 0, since: w.t })
  return p
}
