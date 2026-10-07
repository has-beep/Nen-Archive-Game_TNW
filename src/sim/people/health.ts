/**
 * Bodies: wounds, bleeding, treatment, poison, illness and recovery.
 *
 * A wound lands on one body part at one of three severities and slows the
 * person down in a specific way (see woundMods). Severe wounds bleed until
 * treated. A severed limb can be reattached by a Nen healer within a few weeks
 * (Machi did it for Hisoka); after that it is gone for good.
 */
import { BODY_PARTS, PART_INFO, type BodyPart } from '../constants'
import { L, P, log } from '../history'
import type { Id, Person, Wound, World } from '../types'
import { hpMax, isFree, nenUsable, woundMods } from './person'
import { at, rng } from '../world'
import { change } from './relations'

export function addWound(w: World, p: Person, frac: number, by?: Id, part?: BodyPart): Wound | null {
  const r = rng(w)
  let sev: 1 | 2 | 3 = frac >= 0.42 ? 3 : frac >= 0.24 ? 2 : 1
  let bp = part
  if (!bp) {
    const tot = BODY_PARTS.reduce((s, k) => s + PART_INFO[k].w, 0)
    let x = r.next() * tot
    bp = 'torso'
    for (const k of BODY_PARTS) { x -= PART_INFO[k].w; if (x <= 0) { bp = k; break } }
  }
  const info = PART_INFO[bp]
  const cur = p.wounds.find((x) => x.part === bp && x.left > 0)
  if (cur) {
    if (cur.sev >= 3 && sev <= cur.sev) return null
    sev = Math.min(3, Math.max(sev, cur.sev + 1)) as 1 | 2 | 3
    p.wounds.splice(p.wounds.indexOf(cur), 1)
  } else if (p.wounds.some((x) => x.part === bp && x.perm)) {
    return null
  }
  if (p.wounds.length >= 8) return null
  const perm = sev === 3 && info.lose && (bp !== 'lleg' && bp !== 'rleg' ? true : r.chance(0.2))
  const days = sev === 1 ? r.irange(5, 14) : sev === 2 ? r.irange(30, 70) : r.irange(90, 200)
  const wd: Wound = { part: bp, sev, t: w.t, left: days, bleed: sev >= 2 && info.bleed && (sev === 3 || r.chance(0.4)), treated: false, perm, by }
  p.wounds.push(wd)
  return wd
}

export function woundName(x: Wound): string {
  return PART_INFO[x.part].names[x.sev - 1]
}

/** Can this person treat others? */
export function healerLevel(p: Person): number {
  if (!p.alive) return 0
  let lv = p.skills.medicine / 30
  if (nenUsable(p)) for (const h of p.nen.hatsu.concat(p.nen.stolen)) if (h.effects.some((e) => e.k === 'heal')) lv = Math.max(lv, 3.5)
  return lv
}

/** The best care available where someone is: a healer present, or a hospital. */
export function careAt(w: World, p: Person): { by: Person | null; lvl: number; nen: boolean } | null {
  if (p.trip) return null
  let best: Person | null = null, bl = 0
  for (const q of at(w, p.loc)) {
    if (q === p) continue
    const lv = healerLevel(q)
    if (lv > bl && (q.rel[p.id]?.aff ?? 0) > -30 && !q.conds.some((c) => c.k === 'jailed' || c.k === 'captive')) { bl = lv; best = q }
  }
  const self = healerLevel(p) >= 3.5 ? 3.5 : 0
  const hosp = w.places[p.loc].hospital
  const lvl = Math.max(bl, self, hosp)
  if (lvl <= 0) return null
  const nen = (best ? healerLevel(best) >= 3.5 && bl >= hosp : false) || self >= 3.5
  return { by: bl >= hosp && best ? best : null, lvl, nen }
}

/** Where the nearest adequate care is. */
export function nearestCare(w: World, p: Person, need: number): Id | null {
  let best: Id | null = null, bd = 1e9
  for (const pl of w.places) {
    if (pl.kind === 'beyond' || pl.features.includes('game')) continue
    let ok = pl.hospital >= need
    if (!ok) for (const q of at(w, pl.id)) if (q !== p && healerLevel(q) >= need) { ok = true; break }
    if (!ok) continue
    const A = w.places[p.loc]
    const d = (A.x - pl.x) ** 2 + (A.y - pl.y) ** 2
    if (d < bd) { bd = d; best = pl.id }
  }
  return best
}

export function needsCare(p: Person): number {
  const m = woundMods(p)
  return m.bleeding ? 2 : m.open
}

/**
 * Once a day: bleed, get treated, heal, shake off poison. Returns a cause of
 * death string if the body gives out, otherwise null.
 */
export function bodyTick(w: World, p: Person): string | null {
  const r = rng(w)
  const hm = hpMax(p)
  const resting = p.act.k === 'rest' || p.act.k === 'recover' || p.act.k === 'jail'
  const m = woundMods(p)
  // Treatment
  if (m.open >= 1 || m.bleeding) {
    const c = careAt(w, p)
    if (c) {
      const done: string[] = []
      for (const x of p.wounds) {
        if (x.treated || x.left <= 0) continue
        if (x.sev > c.lvl + 0.5) { x.bleed = false; continue }
        x.treated = true
        x.bleed = false
        if (x.perm && c.nen && x.part !== 'eye' && w.t - x.t <= 30) { x.perm = false; done.push(`reattached ${woundName(x).replace('severed ', '').replace('lost ', '')}`) }
        else if (x.sev >= 2) done.push(woundName(x))
      }
      if (done.length) {
        const cost = 0.05 * done.length * (c.nen ? 3 : 1)
        if (c.by && c.by !== p) {
          if (!p.orgs.some((mm) => c.by!.orgs.some((n) => n.org === mm.org))) { p.jenny -= cost; c.by.jenny += cost }
          change(w, p, c.by, { aff: 8, trust: 6, debt: 0.3 })
          change(w, c.by, p, { aff: 2, fam: 2 })
          c.by.fame += 0.2
          if (p.major || p.owned || done.some((d) => d.startsWith('reattached'))) {
            log(w, { type: 'heal', imp: p.major || p.owned ? 1 : 0, who: [c.by.id, p.id], at: p.loc, text: `${P(c.by)} treats ${P(p)} in ${L(w.places[p.loc])}: ${done.join(', ')}.` })
          }
        } else {
          p.jenny -= cost
        }
      }
    }
  }
  // Bleeding. A conscious person presses on the wound; anyone nearby who
  // does not want them dead helps. Bleeding out is for the alone and the
  // abandoned.
  let bleeding = false
  const awake = !p.conds.some((c) => c.k === 'unconscious' && c.until > w.t)
  let aid = (awake ? 0.25 + p.skills.medicine / 200 : 0) + (nenUsable(p) ? 0.15 : 0)
  if (p.wounds.some((x) => x.bleed && !x.treated)) {
    for (const q of at(w, p.loc)) {
      if (q === p || !isFree(q) || (q.rel[p.id]?.aff ?? 0) < -10) continue
      aid = Math.max(aid, 0.45 + q.skills.medicine / 150)
      break
    }
  }
  for (const x of p.wounds) {
    if (x.bleed && !x.treated && x.left > 0) {
      bleeding = true
      if (r.chance(Math.min(0.9, aid))) x.bleed = false
    }
  }
  if (bleeding) {
    p.hp -= hm * 0.05
    if (p.hp <= 0) return 'bleeding'
  }
  // Poison and illness
  for (const c of p.conds) {
    if (c.k === 'poison' && c.until > w.t) {
      p.hp -= hm * 0.04 * (c.p ?? 1) * (nenUsable(p) ? 0.6 : 1)
      if (p.hp <= 0) return c.note || 'poison'
    }
    if (c.k === 'disease' && c.until > w.t) {
      p.hp -= hm * 0.015 * (c.p ?? 1)
      if (p.hp <= 0) return c.note || 'illness'
    }
    if (c.k === 'contaminated' && c.until > w.t) {
      p.hp -= hm * 0.02 * (c.p ?? 1)
      if (p.hp <= 0) return 'the Rose\'s poison'
    }
  }
  // Natural recovery
  if (!bleeding && p.hp < hm) {
    const worst = m.worst
    p.hp = Math.min(hm, p.hp + hm * 0.035 * w.laws.healing * (resting ? 1.8 : 1) * (worst >= 3 ? 0.5 : 1) * (nenUsable(p) ? 1.3 : 1) * (p.species === 'ant' ? 2 : 1))
  }
  // Wounds knit
  for (let i = p.wounds.length - 1; i >= 0; i--) {
    const x = p.wounds[i]
    if (x.left <= 0) continue
    x.left -= (x.treated ? 1.5 : x.sev >= 2 ? 0.55 : 1) * w.laws.healing * (resting ? 1.3 : 1) * (p.species === 'ant' ? 2 : 1)
    if (x.left <= 0) {
      if (x.perm) {
        x.left = 0
        if (p.major || p.owned) log(w, { type: 'heal', imp: 1, who: [p.id], at: p.loc, text: `${P(p)} will carry this for life: ${woundName(x)}.` })
      } else {
        p.wounds.splice(i, 1)
      }
    }
  }
  // Stamina and aura come back
  p.stam = Math.min(100 - m.stam, p.stam + (resting ? 60 : 30))
  if (p.nen.awake) p.nen.aura = Math.min(1, p.nen.aura + (resting ? 0.5 : 0.3) + p.nen.tech.zetsu / 500)
  // Timed conditions expire
  p.conds = p.conds.filter((c) => c.until > w.t || c.until < 0)
  return null
}
