/**
 * Turning a canon character's written entry into a person in the world.
 */
import type { CanonDef } from '../../data/canon-types'
import type { NenType } from '../constants'
import { TECHS, TECH_INFO } from '../constants'
import type { Person, World } from '../types'
import { makePerson, newNen, attrsFrom, mindFrom, facetsFrom, valuesFrom } from '../people/person'
import { TYPE_LEAN, inferType, randomOrientation } from '../people/traits'
import { compileSpec } from '../nen/hatsu'
import { epochOf } from '../time'
import { placeK, nationK, orgK, rng, registerKey, touch } from '../world'

export function buildCanon(w: World, d: CanonDef): Person {
  const r = rng(w)
  const born = Array.isArray(d.born) ? epochOf(d.born[0], d.born[1] - 1, d.born[2]) - w.epoch : epochOf(d.born, r.int(12), 1 + r.int(28)) - w.epoch
  const facetsPartial = d.p
  // Unknown type: guess from temperament, so their generated Hatsu fits them.
  const provisional = facetsFrom(facetsPartial, () => 50)
  const type: NenType = d.type >= 0 ? (d.type as NenType) : inferType(r, provisional)
  const lean = TYPE_LEAN[type]
  const facets = facetsFrom(facetsPartial, (f) => Math.max(0, Math.min(100, Math.round(50 + (lean[f] || 0) + r.gauss() * 8))))
  const values = valuesFrom(d.v || {}, () => Math.round(r.gauss() * 8))
  const home = placeK(w, d.home)
  const p = makePerson(w, {
    key: d.key, name: d.name, short: d.short, sex: d.sex, born, home: home.id, loc: placeK(w, d.loc || d.home).id,
    nation: nationK(w, d.nation === 'none' ? 'none' : d.nation).id, role: d.role, canon: true,
    attrs: attrsFrom(d.body), mind: mindFrom(d.mind), facets, values,
    nen: newNen(type, d.pot, d.cap), species: d.species || 'human',
  })
  p.major = !!d.major
  p.title = d.title
  p.bio = d.bio
  p.portrait = `/portraits/${d.key}.png`
  p.orient = d.orient || randomOrientation(r)
  p.span = d.span ?? 75 + r.int(15)
  p.weapon = d.weapon || 'fists'
  p.jenny = d.jenny ?? 5
  p.fame = d.fame ?? Math.max(0, (d.lvl - 40) * 0.4)
  p.infamy = d.infamy ?? 0
  p.look = { skin: r.int(5), hair: r.int(10), style: r.int(4), eyes: r.int(5), height: d.sex === 'm' ? 165 + r.int(25) : 155 + r.int(20) }
  for (const k in d.skills || {}) p.skills[k as keyof typeof p.skills] = (d.skills as Record<string, number>)[k]
  if (d.license) p.license = { t: d.license.year ? epochOf(d.license.year, 0, 15) - w.epoch : -400, stars: d.license.stars, field: d.license.field }
  // Nen
  const awake = d.awake !== false && d.lvl > 0
  p.nen.lvl = d.lvl
  if (awake) {
    p.nen.awake = true
    p.nen.how = d.species === 'ant' ? 'ant' : 'slow'
    p.nen.known = true
    for (const t of TECHS) {
      const req = TECH_INFO[t].req
      if (d.lvl >= req) p.nen.tech[t] = Math.round(Math.min(100, 25 + (d.lvl - req) * 1.5 + r.next() * 10))
    }
    p.nen.cat = [0, 1, 2, 3, 4, 5].map((c) => Math.min(100, Math.round(d.lvl * 1.1 * (c === type ? 1 : 0.5))))
    if (d.enR) p.nen.enR = d.enR
    else if (p.nen.tech.en) p.nen.enR = Math.round(p.nen.tech.en / 100 * (8 + d.lvl * 0.35))
  }
  if (d.tech) for (const k in d.tech) p.nen.tech[k as keyof typeof p.nen.tech] = (d.tech as Record<string, number>)[k]
  for (const h of d.hatsu || []) p.nen.hatsu.push(compileSpec(h, p, -365))
  if (d.destined) p.nen.destined = d.destined.slice()
  if ((d.hatsu && d.hatsu.length) || (d.destined && d.destined.length)) p.flags.fixedHatsu = 1
  // Dreams: resolve keys to ids later, once everyone exists.
  p.flags.__dreams = JSON.stringify(d.dreams || [])
  p.flags.__rel = JSON.stringify(d.rel || [])
  p.flags.__orgs = JSON.stringify(d.orgs || [])
  if (d.items) p.flags.__items = JSON.stringify(d.items)
  p.hp = Math.round((40 + p.attrs.tou * 0.75 + p.attrs.endu * 0.35 + p.nen.lvl * 0.25 + (p.species === 'ant' ? 40 : 0)))
  registerKey(w, p)
  touch(w)
  // Ants created mid-game resolve their links at once.
  if (d.species === 'ant') linkCanon(w, p)
  void orgK
  return p
}

/** Second pass: dreams, relationships and memberships reference other keys. */
export function linkCanon(w: World, p: Person) {
  // Imported lazily: worldgen depends on these modules, not the reverse.
  const dreams = JSON.parse((p.flags.__dreams as string) || '[]') as [string, string | null, number, string?][]
  const rels = JSON.parse((p.flags.__rel as string) || '[]') as [string, string, number, number?, number?, number?][]
  const orgs = JSON.parse((p.flags.__orgs as string) || '[]') as [string, number, { num?: number; title?: string; secret?: boolean; loyalty?: number }?][]
  delete p.flags.__dreams; delete p.flags.__rel; delete p.flags.__orgs
  for (const [k, target, pri, tag] of dreams) {
    let tid: number | undefined
    let ttag = tag
    if (target) {
      const person = LINK.personK(w, target)
      if (person) tid = person.id
      else {
        const org = w.orgs.find((o) => o.key === target)
        if (org) { tid = org.id; if (k === 'avenge') ttag = 'org'; if (k === 'serve') ttag = undefined }
        const nat = w.nations.find((n) => n.key === target)
        if (!org && nat) tid = nat.id
      }
      if (k === 'serve' && person) ttag = 'person'
    }
    if (k === 'free' && target && tid == null) continue
    p.dreams.push({ k: k as never, target: tid, tag: ttag, pri, prog: 0, since: w.t })
  }
  for (const [key, bonds, aff, trust, resp, fear] of rels) {
    const q = LINK.personK(w, key)
    if (!q) continue
    const r1 = LINK.relOrNew(w, q, p.id)
    // Entries are written from p's side: "I am X to them". q's view of p:
    r1.aff = Math.max(r1.aff, Math.round(aff * 0.85))
    r1.fam = Math.max(r1.fam, 55)
    const r2 = LINK.relOrNew(w, p, q.id)
    r2.aff = aff
    r2.trust = trust ?? Math.round(aff * 0.6)
    r2.resp = resp ?? 30
    r2.fear = fear ?? 0
    r2.fam = Math.max(r2.fam, 60)
    for (const b of bonds.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (b === 'family') continue
      LINK.setBond(w, q, p, b as never)
    }
  }
  for (const [key, rank, o] of orgs) {
    const org = w.orgs.find((x) => x.key === key)
    if (!org) continue
    p.orgs.push({ org: org.id, rank, t: w.t - 400, loyalty: o?.loyalty ?? 60, num: o?.num, title: o?.title, secret: o?.secret })
  }
  if (p.flags.__items) {
    const items = JSON.parse(p.flags.__items as string) as string[]
    delete p.flags.__items
    for (const k of items) LINK.makeItem(w, k, k === 'gi_copy' ? 'a copy of Greed Island' : k, p.id, k === 'gi_copy' ? 5800 : 10)
    if (items.includes('gi_copy')) p.flags.giAccess = 1
  }
}

import { personK } from '../world'
import { relOrNew } from '../people/person'
import { setBond } from '../people/relations'
import { makeItem } from '../society/economy'
const LINK = { personK, relOrNew, setBond, makeItem }
