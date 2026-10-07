/**
 * Love, marriage and children.
 *
 * Attraction needs adults, compatible orientations, time spent together and
 * a little chemistry nobody chooses. Someone who has fallen for someone has
 * to say so, which takes nerve; a refusal hurts. Couples who stay close long
 * enough marry, and families have children, who grow up into the world with
 * some of their parents' temperament and, sometimes, their gift for Nen.
 */
import { P, L, log } from '../history'
import type { Person, World } from '../types'
import { hash2 } from '../rng'
import { age, isAdult, makePerson, newNen, facetsFrom, valuesFrom } from './person'
import { change, hasBond, setBond } from './relations'
import { remember } from './memory'
import { rng, registerKey, touch } from '../world'
import { compatibility, randomOrientation } from './traits'
import { seedDreams } from './dreams'
import { startStory } from '../story/storyteller'

function attracted(w: World, a: Person, b: Person): boolean {
  if (a === b || !isAdult(w, a) || !isAdult(w, b) || a.species !== b.species) return false
  if (a.orient === 'ace' || b.orient === 'ace') return false
  const same = a.sex === b.sex
  const okA = a.orient === 'bi' || (a.orient === 'straight' ? !same : same)
  const okB = b.orient === 'bi' || (b.orient === 'straight' ? !same : same)
  if (!okA || !okB) return false
  const ya = age(w, a), yb = age(w, b)
  const gap = Math.abs(ya - yb)
  return gap <= Math.max(8, Math.min(ya, yb) * 0.35)
}

function chemistry(a: Person, b: Person): number {
  return hash2(Math.min(a.id, b.id), Math.max(a.id, b.id))
}

function partnerOf(w: World, p: Person): Person | null {
  for (const id in p.rel) if (hasBond(p.rel[+id], 'spouse') || hasBond(p.rel[+id], 'lover')) { const q = w.people[+id]; if (q?.alive) return q }
  return null
}

export function romanceTick(w: World, here: Person[]) {
  if (!w.laws.romance) return
  const r = rng(w)
  for (const a of here) {
    if (!isAdult(w, a) || a.facets.romantic < 15 || a.conds.length) continue
    const partner = partnerOf(w, a)
    // Courtship.
    for (const b of here) {
      if (b === a || !attracted(w, a, b)) continue
      const ra = a.rel[b.id]
      if (!ra || ra.fam < 15) continue
      const chem = chemistry(a, b)
      if (chem < 0.45) continue
      const grow = (chem - 0.4) * 1.6 * (a.facets.romantic / 60) * (0.4 + compatibility(a, b)) * (partner && partner !== b ? 0.1 : 1)
      if (grow > 0) change(w, a, b, { attr: grow })
      // Confession.
      if (ra.attr >= 55 && !partner && !hasBond(ra, 'lover') && !hasBond(ra, 'ex') && r.chance(0.08 + a.facets.bravery / 900)) {
        const rb = b.rel[a.id]
        const bPartner = partnerOf(w, b)
        const yes = !bPartner && rb && rb.attr >= 35 && rb.aff > 20
        if (yes) {
          setBond(w, a, b, 'lover')
          change(w, a, b, { aff: 15, trust: 10 })
          change(w, b, a, { aff: 15, trust: 10 })
          const ev = log(w, { type: 'romance', imp: a.major || b.major || a.owned || b.owned ? 3 : 1, who: [a.id, b.id], at: a.loc, text: `${P(a)} tells ${P(b)} how they feel. ${P(b)} feels the same.` })
          remember(w, a, { k: 'love', who: b.id, val: 60, str: 60, ev, text: `${b.name} said yes.` })
          remember(w, b, { k: 'love', who: a.id, val: 55, str: 55, ev, text: `${a.name} said they loved me.` })
          if (a.major || b.major) startStory(w, 'romance', `${a.short} and ${b.short}`, [a.id, b.id], ev, `love-${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`)
        } else {
          change(w, a, b, { attr: -15, aff: -4 })
          a.mood.grief = Math.min(100, a.mood.grief + 15)
          if (a.major || a.owned) log(w, { type: 'romance', imp: 1, who: [a.id, b.id], at: a.loc, text: `${P(a)} tells ${P(b)} how they feel, and ${P(b)} does not feel the same.` })
          remember(w, a, { k: 'rejected', who: b.id, val: -35, str: 40, text: `${b.name} turned me down.` })
        }
      }
    }
    if (!partner) continue
    const rp = a.rel[partner.id]
    if (!rp) continue
    // Breaking up.
    const formal = /prince|royal|ruler/.test(a.role) || /prince|royal|ruler/.test(partner.role)
    if (!formal && w.t - rp.t > 0 && (rp.aff < 8 || rp.trust < -30) && (partner.rel[a.id]?.aff ?? 0) < 30 && r.chance(0.04)) {
      setBond(w, a, partner, 'lover', false)
      setBond(w, a, partner, 'spouse', false)
      setBond(w, a, partner, 'ex')
      const ev = log(w, { type: 'romance', imp: a.major || partner.major ? 2 : 1, who: [a.id, partner.id], at: a.loc, text: `${P(a)} and ${P(partner)} split up.` })
      remember(w, a, { k: 'breakup', who: partner.id, val: -40, str: 45, ev, text: `Split up with ${partner.name}.` })
      remember(w, partner, { k: 'breakup', who: a.id, val: -40, str: 45, ev, text: `Split up with ${a.name}.` })
      continue
    }
    // Marriage.
    if (hasBond(rp, 'lover') && !hasBond(rp, 'spouse') && w.t - rp.t0 > 150 && rp.aff > 65 && (partner.rel[a.id]?.aff ?? 0) > 60 && r.chance(0.01 * (1 + a.needW.family))) {
      setBond(w, a, partner, 'lover', false)
      setBond(w, a, partner, 'spouse')
      const ev = log(w, { type: 'romance', imp: a.major || partner.major ? 3 : 2, who: [a.id, partner.id], at: a.loc, text: `${P(a)} and ${P(partner)} marry in ${L(w.places[a.loc])}.` })
      remember(w, a, { k: 'married', who: partner.id, val: 70, str: 70, ev, text: `Married ${partner.name}.` })
      remember(w, partner, { k: 'married', who: a.id, val: 70, str: 70, ev, text: `Married ${a.name}.` })
      for (const d of a.dreams.concat(partner.dreams)) if (d.k === 'family') d.prog = Math.max(d.prog, 50)
    }
    // Children.
    if (hasBond(rp, 'spouse') && a.sex === 'f' && partner.sex === 'm' && age(w, a) >= 18 && age(w, a) <= 44 && a.species === 'human' && !a.conds.some((c) => c.k === 'pregnant') && r.chance(0.0035 * (1 + a.needW.family))) {
      a.conds.push({ k: 'pregnant', until: w.t + 270, by: partner.id })
    }
  }
}

/** Called daily for each person: births. */
export function birthCheck(w: World, mother: Person) {
  const c = mother.conds.find((x) => x.k === 'pregnant')
  if (!c || c.until > w.t + 1) return
  mother.conds = mother.conds.filter((x) => x !== c)
  const father = c.by != null ? w.people[c.by] : null
  bear(w, mother, father)
}

export function bear(w: World, mother: Person, father: Person | null): Person {
  const r = rng(w)
  const mix = (k: 'facets' | 'values') => (f: string) => {
    const a = (mother[k] as Record<string, number>)[f], b = father ? (father[k] as Record<string, number>)[f] : a
    return Math.round((a + b) / 2 + r.gauss() * (k === 'facets' ? 15 : 14))
  }
  const facets = facetsFrom({}, mix('facets') as never)
  const values = valuesFrom({}, mix('values') as never)
  for (const k in facets) facets[k as keyof typeof facets] = Math.max(0, Math.min(100, facets[k as keyof typeof facets]))
  for (const k in values) values[k as keyof typeof values] = Math.max(-50, Math.min(50, values[k as keyof typeof values]))
  const sex: 'm' | 'f' = r.chance(0.5) ? 'm' : 'f'
  const family = (father || mother).name.includes(' ') ? (father || mother).name.split(' ').slice(-1)[0] : ''
  const given = sex === 'm' ? r.pick(['Aron', 'Bram', 'Cal', 'Dez', 'Eli', 'Finn', 'Gil', 'Hal', 'Ian', 'Jem', 'Kai', 'Leo', 'Milo', 'Nate', 'Owen', 'Rey', 'Sol', 'Tam']) : r.pick(['Ada', 'Bea', 'Cora', 'Dina', 'Eva', 'Fay', 'Gia', 'Hope', 'Ivy', 'Jade', 'Kit', 'Lia', 'Maya', 'Nora', 'Opal', 'Rae', 'Sia', 'Tia'])
  const pot = Math.max(0.2, Math.min(1.9, ((mother.nen.pot + (father?.nen.pot ?? mother.nen.pot)) / 2) * (0.8 + r.next() * 0.5)))
  const type = r.chance(0.5) ? mother.nen.type : (father?.nen.type ?? mother.nen.type)
  const kid = makePerson(w, {
    name: family ? `${given} ${family}` : given, sex, born: w.t, home: mother.loc, nation: mother.nation, role: 'child',
    attrs: { str: 10, agi: 12, tou: 12, endu: 12, refl: 12, senses: 30 + r.int(30) },
    mind: { int: 30 + r.int(40), will: 30 + r.int(40), focus: 30 + r.int(40), intuition: 30 + r.int(40), charisma: 30 + r.int(40) },
    facets, values, nen: newNen(type, pot, Math.round(40 + pot * 35 + r.int(15))),
  })
  kid.orient = randomOrientation(r)
  kid.span = 70 + r.int(25)
  kid.look = { skin: mother.look.skin, hair: r.chance(0.5) ? mother.look.hair : father?.look.hair ?? mother.look.hair, style: r.int(4), eyes: mother.look.eyes, height: 50 }
  setBond(w, kid, mother, 'parent')
  if (father) setBond(w, kid, father, 'parent')
  for (const p of [mother, father]) {
    if (!p) continue
    change(w, p, kid, { aff: 80, trust: 60, fam: 50 })
    change(w, kid, p, { aff: 70, trust: 70, fam: 50 })
    for (const id in p.rel) if (hasBond(p.rel[+id], 'child') && +id !== kid.id) { const sib = w.people[+id]; if (sib?.alive) setBond(w, kid, sib, 'sibling') }
  }
  // A Zoldyck is born into the family business.
  for (const m of mother.orgs.concat(father?.orgs || [])) {
    const org = w.orgs[m.org]
    if (org.kind === 'family' || org.kind === 'royal' || org.kind === 'clan') kid.orgs.push({ org: org.id, rank: 2, t: w.t, loyalty: 70, title: 'Child' })
  }
  kid.orgs = kid.orgs.filter((m, i, a) => a.findIndex((x) => x.org === m.org) === i)
  touch(w)
  registerKey(w, kid)
  const big = mother.major || father?.major || mother.owned || father?.owned
  const ev = log(w, { type: 'birth', imp: big ? 3 : 1, who: father ? [kid.id, mother.id, father.id] : [kid.id, mother.id], at: mother.loc, text: `${P(mother)}${father ? ` and ${P(father)}` : ''} have a ${sex === 'm' ? 'son' : 'daughter'}, ${P(kid)}.` })
  remember(w, mother, { k: 'child', who: kid.id, val: 70, str: 75, ev, text: `${kid.name} was born.` })
  if (father) remember(w, father, { k: 'child', who: kid.id, val: 65, str: 70, ev, text: `${kid.name} was born.` })
  return kid
}

/** Children grow up: at fourteen they start wanting things of their own. */
export function growUp(w: World, p: Person) {
  const a = age(w, p)
  if (p.role === 'child' && a >= 14) {
    p.role = 'drifter'
    if (!p.dreams.length) seedDreams(w, p)
  }
  if (a < 20 && p.species === 'human') {
    const g = 0.012
    p.attrs.str = Math.min(p.attrs.str + g * 3, 70)
    p.attrs.agi = Math.min(p.attrs.agi + g * 3, 70)
    p.attrs.tou = Math.min(p.attrs.tou + g * 3, 70)
    p.attrs.endu = Math.min(p.attrs.endu + g * 3, 70)
    p.attrs.refl = Math.min(p.attrs.refl + g * 3, 70)
    p.look.height = Math.min(185, p.look.height + 0.03)
  }
}
