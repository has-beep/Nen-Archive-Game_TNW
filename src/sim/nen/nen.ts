/**
 * Growing in Nen: awakening, training, learning techniques one at a time,
 * finding one's type, and building a Hatsu.
 *
 * There are two ways to open the aura nodes. The slow way is months of
 * meditation under a teacher. The fast way is a teacher blasting them open,
 * which works in seconds and can kill (Wing did it to Gon and Killua; the
 * Chimera Ants did it to whole crowds). Heavens Arena's 200th floor does it
 * by accident to anyone who walks in without Nen.
 */
import { NEN_TYPES, TECHS, TECH_INFO, WATER_DIVINATION } from '../constants'
import type { NenType, Tech } from '../constants'
import { L, P, log } from '../history'
import type { Hatsu, Id, Person, World } from '../types'
import { age, auraMax, eff, hpMax } from '../people/person'
import { remember } from '../people/memory'
import { rng } from '../world'
import { compileSpec, generateHatsu, type GenOpts } from './hatsu'

export function awaken(w: World, p: Person, how: 'slow' | 'forced' | 'trauma' | 'innate' | 'ant', by?: Person, cause?: Id): Id | undefined {
  if (p.nen.awake) return
  const r = rng(w)
  p.nen.awake = true
  p.nen.t = w.t
  p.nen.how = how
  p.nen.aura = 0.3
  p.nen.tech.ten = Math.max(p.nen.tech.ten, how === 'slow' ? 25 : 8)
  // A latent talent that has been training its body already has some level.
  p.nen.lvl = Math.max(p.nen.lvl, 4)
  let text = ''
  let imp = p.major || p.owned ? 3 : p.canon ? 2 : 1
  if (how === 'forced' && by) {
    text = `${P(by)} forces open the aura nodes of ${P(p)} in ${L(w.places[p.loc])}. It is the fast way, and the dangerous one.`
    p.stam = 0
    const risk = 0.04 + Math.max(0, 50 - p.attrs.tou) / 600
    if (r.chance(risk * 2)) {
      p.hp = Math.max(1, p.hp - hpMax(p) * 0.6)
      text += ` ${P(p)} collapses and does not wake for three days.`
      p.conds.push({ k: 'unconscious', until: w.t + 3 })
    }
  } else if (how === 'slow' && by) {
    text = `After weeks of meditation under ${P(by)}, ${P(p)} feels aura for the first time, and learns Ten.`
  } else if (how === 'trauma') {
    text = `Something in ${P(p)} breaks open. They can see aura now.`
  } else if (how === 'ant') {
    text = `${P(p)} is born already able to use Nen, as the King's soldiers are.`
    imp = 0
  } else {
    text = `${P(p)} opens their aura nodes alone in ${L(w.places[p.loc])}, with no teacher at all.`
  }
  p.fame += 1
  const ev = log(w, { type: 'nen', imp, text, who: by ? [p.id, by.id] : [p.id], at: p.loc, cause })
  remember(w, p, { k: 'awaken', val: 40, str: 70, ev, text: 'Felt aura for the first time.', who: by?.id })
  return ev
}

/**
 * One day of Nen training. `focus` is a technique, a category index, or
 * 'base' for general aura capacity. A teacher in the same place makes it go
 * much faster, and a good dojo, Heavens Arena's upper floors or Greed Island
 * a little faster still.
 */
export function trainNen(w: World, p: Person, focus: string, mentor?: Person, intensity = 1): void {
  if (!p.nen.awake) return
  const r = rng(w)
  const place = w.places[p.loc]
  const m = mentor ? 1.45 + Math.min(0.4, mentor.nen.lvl / 250) : 1
  const site = place.features.includes('dojo') ? 1.12 : place.features.includes('game') ? 1.2 : place.key === 'arena' ? 1.1 : 1
  const mood = 0.75 + p.mood.happy / 200 - p.mood.stress / 400
  const youth = age(w, p) < 25 ? 1.1 : age(w, p) > 55 ? 0.7 : 1
  const capRoom = Math.max(0, 1 - p.nen.lvl / (p.nen.cap + 4))
  const g = 0.075 * p.nen.pot * w.laws.growth * m * site * mood * youth * intensity * capRoom * (0.6 + r.next() * 0.8)
  const before = p.nen.lvl
  p.nen.lvl = Math.min(130, p.nen.lvl + g)
  // Techniques: mastery grows with practice, and the next one opens up with level.
  if (TECHS.includes(focus as Tech)) {
    const t = focus as Tech
    const req = TECH_INFO[t].req
    if (p.nen.lvl >= req) p.nen.tech[t] = Math.min(100, p.nen.tech[t] + (2.2 + p.mind.focus / 60) * m * intensity * (0.5 + r.next()))
    if (t === 'en') p.nen.enR = Math.max(p.nen.enR, Math.round(p.nen.tech.en / 100 * (10 + p.nen.lvl * 0.6)))
  } else if (/^\d$/.test(focus)) {
    const c = +focus as NenType
    const capC = eff(p, c) * 100
    p.nen.cat[c] = Math.min(capC, p.nen.cat[c] + 1.6 * m * intensity * (0.5 + r.next()) * (p.nen.type === c ? 1.2 : 0.8))
  } else {
    // General training spreads a little into every technique already known.
    for (const t of TECHS) if (p.nen.tech[t] > 0 && p.nen.tech[t] < 100) p.nen.tech[t] = Math.min(100, p.nen.tech[t] + 0.35 * m * intensity)
    p.nen.cat[p.nen.type] = Math.min(100, p.nen.cat[p.nen.type] + 0.25 * m * intensity)
  }
  if (Math.floor(p.nen.lvl / 10) > Math.floor(before / 10) && p.nen.lvl >= 20) {
    log(w, {
      type: 'train', imp: p.major || p.owned ? 2 : 0, who: mentor ? [p.id, mentor.id] : [p.id], at: p.loc,
      text: `${P(p)} breaks through in training${mentor ? ` under ${P(mentor)}` : ''}. Nen level ${Math.floor(p.nen.lvl)}, about ${auraMax(p).toLocaleString('en-US')} aura.`,
    })
  }
}

/** Which technique someone should practise next: the first one they are ready
 *  for and have not mastered, roughly in the order Shingen-ryu teaches. */
export function nextTech(p: Person): Tech | null {
  for (const t of TECHS) {
    const req = TECH_INFO[t].req
    if (p.nen.lvl >= req && p.nen.tech[t] < 40) return t
  }
  for (const t of TECHS) if (p.nen.lvl >= TECH_INFO[t].req && p.nen.tech[t] < 85) return t
  return null
}

/** Announce techniques the moment they become usable (mastery crosses 20). */
export function techMilestones(w: World, p: Person, before: Record<Tech, number>, mentor?: Person) {
  for (const t of TECHS) {
    if (before[t] < 20 && p.nen.tech[t] >= 20) {
      let text = `${P(p)} learns ${TECH_INFO[t].n}${mentor ? ` from ${P(mentor)}` : ''}.`
      let imp = p.major || p.owned ? 1 : 0
      if (t === 'hatsu' && !p.nen.known) {
        p.nen.known = true
        text += ` Water divination: ${WATER_DIVINATION[p.nen.type]}. ${P(p)} is ${p.nen.type === 0 || p.nen.type === 5 ? 'an' : 'a'} ${NEN_TYPES[p.nen.type]}.`
        imp = p.major || p.owned ? 2 : 1
      }
      log(w, { type: 'nen', imp, text, who: mentor ? [p.id, mentor.id] : [p.id], at: p.loc })
    }
  }
}

/** Ready to build a Hatsu: enough level, Ren, and some feel for their own type. */
export function readyForHatsu(p: Person): boolean {
  if (!p.nen.awake || p.nen.burnedOut) return false
  if (p.flags.fixedHatsu) return !!p.nen.destined?.some((d) => (d.at ?? 30) <= p.nen.lvl + 2 && d.kind !== 'spirit_beast')
  if (p.nen.hatsu.length === 0) return p.nen.lvl >= 30 && p.nen.tech.ren >= 30 && p.nen.tech.hatsu >= 20
  if (p.nen.hatsu.length === 1) return p.nen.lvl >= 62 && p.mind.int >= 50
  if (p.nen.hatsu.length === 2) return p.nen.lvl >= 80 && p.mind.int >= 70
  return false
}

/**
 * Build a Hatsu. A canon character with a destined ability gets it once they
 * reach its level. Everyone else invents one; the player can step in here
 * through the Hatsu Forge crossroad.
 */
export function develop(w: World, p: Person, o: GenOpts & { spec?: Hatsu; cause?: Id; quiet?: boolean } = {}): Hatsu | null {
  const r = rng(w)
  let h: Hatsu | null = null
  if (o.spec) h = o.spec
  else if (p.nen.destined && p.nen.destined.length) {
    const ready = p.nen.destined.filter((d) => (d.at ?? 30) <= p.nen.lvl + 2 && d.kind !== 'spirit_beast')
    if (ready.length) {
      // Destined abilities that share a theme arrive together (Jajanken's three hands).
      const first = ready[0]
      const batch = ready.filter((d) => d.kind === first.kind || d.name.split(':')[0] === first.name.split(':')[0])
      for (const d of batch) {
        const hh = compileSpec(d, p, w.t)
        p.nen.hatsu.push(hh)
        h = h || hh
      }
      p.nen.destined = p.nen.destined.filter((d) => !batch.includes(d))
      for (const hh of p.nen.hatsu.slice(-batch.length)) p.nen.cat[hh.cats[0][0]] = Math.max(p.nen.cat[hh.cats[0][0]], 30)
      if (!o.quiet) announce(w, p, h!, batch.length, o.cause)
      return h
    }
  }
  if (!h) {
    const grudge = grudgeOf(w, p)
    const kind = o.kind || (p.role === 'doctor' || p.skills.medicine > 50 ? (r.chance(0.6) ? 'mend' : undefined) : undefined)
    h = generateHatsu(w, r, p, { ...o, kind, grudge: o.grudge || grudge })
    // A character from the Archive gets their ability's real name.
    if (p.flags.abilityNames) {
      const names = JSON.parse(p.flags.abilityNames as string) as string[]
      const nm = names.shift()
      if (nm) h.name = nm
      if (names.length) p.flags.abilityNames = JSON.stringify(names); else delete p.flags.abilityNames
    }
  }
  p.nen.hatsu.push(h)
  p.nen.cat[h.cats[0][0]] = Math.max(p.nen.cat[h.cats[0][0]], 25)
  if (!o.quiet) announce(w, p, h, 1, o.cause)
  return h
}

function announce(w: World, p: Person, h: Hatsu, n: number, cause?: Id) {
  const first = p.nen.hatsu.length === n
  p.fame += first ? 3 : 2
  const conds = h.conds.length ? ` ${h.conds.length > 1 ? 'Conditions' : 'Condition'}: ${h.conds.map((c) => c.text.replace(/\.$/, '')).join('; ')}.` : ''
  const text = n > 1
    ? `${P(p)} develops a set of abilities around "${h.name.split(':')[0]}". ${h.desc}`
    : `${P(p)} develops ${first ? 'a Hatsu' : 'another Hatsu'}, "${h.name}". ${h.desc}${conds}`
  const ev = log(w, { type: 'hatsu', imp: p.major || p.owned ? 3 : first ? 2 : 1, who: [p.id], at: p.loc, text, cause, data: { hatsu: h.id } })
  remember(w, p, { k: 'hatsu', val: 50, str: 60, ev, text: `Created ${h.name}.` })
}

/** If someone is consumed by a grudge, their ability bends around it. */
function grudgeOf(w: World, p: Person): GenOpts['grudge'] {
  for (const d of p.dreams) {
    if (d.k === 'avenge' && d.pri > 70 && d.target != null) {
      if (d.tag === 'org') {
        const o = w.orgs[d.target]
        if (o && !o.dead) return { org: o.id, label: `members of the ${o.name}` }
      } else {
        const t = w.people[d.target]
        if (t && t.alive) return { person: t.id, label: t.name }
      }
    }
  }
  return undefined
}

/** Nen slows ageing: Ten keeps the body young (Bisky, Netero). */
export function nenLongevity(p: Person): number {
  if (!p.nen.awake) return 0
  return Math.round(p.nen.lvl / 6 + p.nen.tech.ten / 25)
}
