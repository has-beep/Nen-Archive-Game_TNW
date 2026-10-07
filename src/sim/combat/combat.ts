/**
 * The fight engine.
 *
 * A fight is played out in exchanges of about two seconds on a small arena.
 * Every fighter has a position, a pool of aura, a stance (how their aura is
 * split between attack and defence, the way Ryu describes it), and what they
 * know about their opponents' abilities. Each exchange they pick an action:
 * close in, strike, shoot, guard, gather aura for a Ko, use a Hatsu, explain
 * a rule, protect an ally, run, or give up.
 *
 * The numbers are chosen so the series' set pieces fall out on their own:
 * bullets bounce off strong Nen users because their guard grows with aura and
 * the bullet does not; an unknown ability lands harder than a known one; a
 * vow-bound ability is terrifying against its one target; a charged punch is
 * devastating if it connects and wasted if the target reads it.
 */
import { NEN_TYPES, TECH_INFO } from '../constants'
import type { BodyPart } from '../constants'
import { WEAPONS, type WeaponDef } from '../../data/weapons'
import type { Hatsu, HatsuCond, Id, Person, World } from '../types'
import { auraMax, auraOutput, hpMax, nenUsable, power, woundMods } from '../people/person'
import { hatsuPower, hasCondK } from '../nen/hatsu'
import { addWound, woundName } from '../people/health'
import { abilityFact, knowsAbility, witness } from '../people/knowledge'
import { rng, at, orgK } from '../world'
import type { Rng } from '../rng'

export type FightIntent = 'spar' | 'duel' | 'kill' | 'capture' | 'war' | 'defend' | 'arena' | 'escape'

export interface Extra {
  name: string
  str: number
  agi: number
  tou: number
  skill: number
  weapon: string
  count: number
}

export interface FightOpts {
  a: Person[]
  b: Person[]
  intentA: FightIntent
  intentB?: FightIntent
  place: Id
  why?: string
  cause?: Id
  ambush?: boolean
  arena?: boolean
  /** Unnamed fighters on side b (guards, soldiers). */
  extrasB?: Extra[]
  extrasA?: Extra[]
  /** Someone side a is trying to protect, or side b is. */
  protectA?: Id
  protectB?: Id
  maxExchanges?: number
  label?: string
  /** Always keep the blow-by-blow. */
  record?: boolean
  night?: boolean
}

export type Out = null | 'down' | 'dead' | 'fled' | 'yield' | 'captured' | 'controlled'

interface Status { mult: number; dur: number; stat?: string }

export interface F {
  i: number
  p?: Person
  name: string
  token: string
  side: 0 | 1
  x: number
  y: number
  hp: number
  hpMax: number
  aura: number
  auraMax: number
  out: number
  attrs: { str: number; agi: number; tou: number; refl: number; senses: number; int: number; will: number }
  skill: number
  weapon: WeaponDef
  nen: boolean
  tech: Record<string, number>
  stance: 'ten' | 'ren' | 'ken' | 'ko' | 'zetsu' | 'in' | 'none'
  off: number
  gyo: boolean
  bound: number
  stun: number
  sealed: number
  buffs: Status[]
  debuffs: Status[]
  shield: Status | null
  summons: { name: string; p: number; dur: number }[]
  speed: Status | null
  sense: Status | null
  stealth: number
  charging: { h: Hatsu; n: number } | null
  koCharge: boolean
  debt: number
  touched: Set<number>
  explained: Set<number>
  tookHit: boolean
  used: Record<string, number>
  known: Set<string>
  morale: number
  outState: Out
  intent: FightIntent
  dealt: number
  taken: number
  usedHatsu: Set<string>
  staked: Hatsu | null
  bomb: { by: number; t: number; p: number } | null
  transformed: { h: Hatsu; dur: number; p: number } | null
  zetsuAfter: boolean
  extra: boolean
  protect?: Id
  lastTarget?: number
  killedBy?: number
  controlledBy?: number
  poison: number
  revealed: Set<number>
}

export interface Beat {
  by: number
  x: string
  hp: number[]
  au: number[]
  pos: [number, number][]
  fx?: string
  tgt?: number
  w: number
}

export interface FightResult {
  winner: 0 | 1 | -1
  fighters: F[]
  beats: Beat[]
  exchanges: number
  how: string
  ended: 'rout' | 'time' | 'capture' | 'control'
}

const MELEE = 2.6
const MID = 22

/* ================= Setup ================= */

function fromPerson(w: World, p: Person, side: 0 | 1, i: number, intent: FightIntent): F {
  const wm = woundMods(p)
  const am = auraMax(p)
  const weapon = WEAPONS[p.weapon] || WEAPONS.fists
  const skill = weapon.skill === 'unarmed' ? Math.max(p.skills.unarmed, p.skills.assassination * 0.8) : p.skills[weapon.skill]
  const hm = hpMax(p)
  const curse = p.conds.find((c) => c.k === 'curse')
  const f: F = {
    i, p, name: p.short, token: `{p${p.id}}`, side,
    x: side === 0 ? 10 : 30, y: 8 + (i % 5) * 4,
    hp: Math.max(1, p.hp), hpMax: hm, aura: am * p.nen.aura, auraMax: am, out: auraOutput(p),
    attrs: {
      str: p.attrs.str * wm.atk * (curse ? curse.p ?? 0.8 : 1), agi: p.attrs.agi * wm.spd, tou: p.attrs.tou, refl: p.attrs.refl,
      senses: p.attrs.senses, int: p.mind.int, will: p.mind.will,
    },
    skill, weapon, nen: nenUsable(p), tech: { ...p.nen.tech },
    stance: nenUsable(p) ? 'ren' : 'none', off: 0.5, gyo: false,
    bound: 0, stun: 0, sealed: 0, buffs: [], debuffs: [], shield: null, summons: [], speed: null, sense: null, stealth: 0,
    charging: null, koCharge: false, debt: 0, touched: new Set(), explained: new Set(), tookHit: false, used: {}, known: new Set(),
    morale: 60 + p.facets.bravery * 0.3 + p.mind.will * 0.1 - p.mood.fear * 0.3, outState: null, intent, dealt: 0, taken: 0,
    usedHatsu: new Set(), staked: null, bomb: null, transformed: null, zetsuAfter: false, extra: false, poison: 0, revealed: new Set(),
  }
  if (curse) f.out *= curse.p ?? 0.8
  if (p.stam < 30) { f.attrs.agi *= 0.85; f.attrs.str *= 0.85 }
  return f
}

function fromExtra(e: Extra, side: 0 | 1, i: number, n: number, intent: FightIntent): F {
  const weapon = WEAPONS[e.weapon] || WEAPONS.fists
  const hm = Math.round(40 + e.tou * 0.75 + 20)
  return {
    i, name: e.count > 1 ? `${e.name} ${n + 1}` : e.name, token: e.count > 1 ? `${e.name} ${n + 1}` : e.name, side,
    x: side === 0 ? 10 : 30, y: 4 + (i % 7) * 3, hp: hm, hpMax: hm, aura: 0, auraMax: 0, out: 0,
    attrs: { str: e.str, agi: e.agi, tou: e.tou, refl: e.agi, senses: 50, int: 45, will: 45 },
    skill: e.skill, weapon, nen: false, tech: {}, stance: 'none', off: 0.5, gyo: false,
    bound: 0, stun: 0, sealed: 0, buffs: [], debuffs: [], shield: null, summons: [], speed: null, sense: null, stealth: 0,
    charging: null, koCharge: false, debt: 0, touched: new Set(), explained: new Set(), tookHit: false, used: {}, known: new Set(),
    morale: 55, outState: null, intent, dealt: 0, taken: 0, usedHatsu: new Set(), staked: null, bomb: null, transformed: null,
    zetsuAfter: false, extra: true, poison: 0, revealed: new Set(),
  }
}

/* ================= The fight ================= */

export function runFight(w: World, o: FightOpts): FightResult {
  const r = rng(w)
  const intentB: FightIntent = o.intentB || (o.intentA === 'spar' || o.intentA === 'arena' ? o.intentA : o.intentA === 'duel' ? 'duel' : 'defend')
  const F: F[] = []
  o.a.forEach((p) => F.push(fromPerson(w, p, 0, F.length, o.intentA)))
  o.b.forEach((p) => F.push(fromPerson(w, p, 1, F.length, intentB)))
  for (const e of o.extrasA || []) for (let n = 0; n < e.count; n++) F.push(fromExtra(e, 0, F.length, n, o.intentA))
  for (const e of o.extrasB || []) for (let n = 0; n < e.count; n++) F.push(fromExtra(e, 1, F.length, n, intentB))
  if (o.protectA != null) for (const f of F) if (f.side === 0) f.protect = o.protectA
  if (o.protectB != null) for (const f of F) if (f.side === 1) f.protect = o.protectB
  const night = o.night ?? r.chance(0.3)
  // What each fighter already knows about the others' abilities.
  for (const f of F) {
    if (!f.p) continue
    for (const g of F) {
      if (!g.p || g.side === f.side) continue
      for (const h of g.p.nen.hatsu.concat(g.p.nen.stolen)) if (knowsAbility(w, f.p, g.p.id, h.id)) f.known.add(h.id)
    }
  }
  const beats: Beat[] = []
  const rec = (by: number, x: string, wt: number, fx?: string, tgt?: number) => {
    beats.push({ by, x, hp: F.map((f) => Math.max(0, Math.round(f.hp))), au: F.map((f) => Math.round(f.aura)), pos: F.map((f) => [Math.round(f.x * 10) / 10, Math.round(f.y * 10) / 10]), fx, tgt, w: wt })
  }
  const ctx: Ctx = { w, r, F, rec, o, night, exchange: 0 }

  // An ambush: whoever moves first from Zetsu gets one free strike, unless the
  // target keeps En up or notices them.
  if (o.ambush) {
    for (const a of F.filter((f) => f.side === 0 && !f.extra)) {
      const tgt = pickTarget(ctx, a)
      if (!tgt) continue
      const hidden = (a.p!.skills.stealth + (a.tech.zetsu || 0)) / 2
      const notice = (tgt.attrs.senses + (tgt.p?.skills.perception || 0)) / 2 + (tgt.tech.en > 30 ? 60 : 0)
      a.x = tgt.x - 1.5; a.y = tgt.y
      if (r.next() * 100 + hidden > notice + 35) {
        const res = strike(ctx, a, tgt, { mult: 1.35, pBonus: 0.35, pierce: true })
        rec(a.i, res ? `${a.token} comes out of Zetsu behind ${tgt.token}. ${tail(ctx, res)}` : `${a.token} comes out of Zetsu. ${tgt.token} turns just in time.`, res ? 0.6 + res.fr : 0.3, 'ambush', tgt.i)
      } else {
        rec(a.i, `${tgt.token} senses ${a.token} coming and turns to face them.`, 0.2, 'notice', tgt.i)
      }
    }
  }

  const maxEx = o.maxExchanges ?? (o.arena ? 30 : 45)
  let ended: FightResult['ended'] = 'time'
  for (ctx.exchange = 0; ctx.exchange < maxEx; ctx.exchange++) {
    const order = F.filter((f) => !f.outState).sort((a, b) => initiative(ctx, b) - initiative(ctx, a))
    for (const f of order) {
      if (f.outState) continue
      if (sideDone(F, 0) || sideDone(F, 1)) break
      turn(ctx, f)
    }
    // Things that tick at the end of an exchange.
    for (const f of F) {
      if (f.outState) continue
      for (const s of f.summons) {
        if (s.dur <= 0) continue
        s.dur--
        const tgt = pickTarget(ctx, f)
        if (tgt) {
          const res = strike(ctx, f, tgt, { mult: 0.55 * s.p, pBonus: -0.03, fromSummon: true })
          if (res && res.d > 0) rec(f.i, `${s.name} tears into ${tgt.token}. ${tail(ctx, res)}`, 0.2 + res.fr, 'summon', tgt.i)
        }
      }
      f.summons = f.summons.filter((s) => s.dur > 0)
      tickStatus(f)
      if (f.bomb && f.bomb.t <= ctx.exchange) {
        const by = F[f.bomb.by]
        if (r.chance(0.12 + f.attrs.int / 600) && by && !by.outState && dist(f, by) < 4) {
          rec(f.i, `${f.token} slaps ${by.token} and says the words: "Bomber, I caught you." The bomb disarms.`, 0.6, 'defuse', by.i)
          f.bomb = null
        } else {
          const d = Math.round(f.hpMax * 0.45 * f.bomb.p)
          f.hp -= d
          f.bomb = null
          rec(f.i, `The bomb planted in ${f.token} goes off (${d}).`, 1, 'explode')
          if (f.p) addWound(w, f.p, 0.5, by?.p?.id)
          checkDown(ctx, f, by)
        }
      }
      if (f.poison > 0) {
        const d = Math.max(1, Math.round(f.hpMax * 0.03 * f.poison))
        f.hp -= d
        f.poison = Math.max(0, f.poison - 0.25)
        checkDown(ctx, f, undefined)
      }
      // Stamina is aura's shadow: holding Ken drains, Zetsu recovers.
      if (f.nen && !f.sealed) {
        const cost = f.stance === 'ken' ? 1.6 : f.stance === 'ren' ? 0.9 : f.stance === 'ko' ? 2.2 : f.stance === 'zetsu' ? -0.4 : 0.3
        f.aura = Math.max(0, Math.min(f.auraMax, f.aura - f.out * cost * 0.35))
        if (f.gyo) f.aura = Math.max(0, f.aura - f.out * 0.1)
        if (f.aura < f.out * 0.3 && f.stance !== 'zetsu') { f.stance = 'ten'; }
      }
      if (f.transformed) {
        f.transformed.dur--
        const lc = hasCondK(f.transformed.h, 'life_cost')
        if (lc && f.p) f.p.nen.lifeSpent += 2
        if (f.transformed.dur <= 0) {
          const h = f.transformed.h
          f.transformed = null
          if (hasCondK(h, 'zetsu_after')) { f.zetsuAfter = true; f.stance = 'zetsu'; rec(f.i, `${f.token}'s ${h.name} wears off and leaves them in Zetsu.`, 0.3, 'zetsu') }
        }
      }
      morale(ctx, f)
    }
    if (sideDone(F, 0) || sideDone(F, 1)) { ended = 'rout'; break }
  }
  const winner = sideDone(F, 1) && !sideDone(F, 0) ? 0 : sideDone(F, 0) && !sideDone(F, 1) ? 1 : -1
  let how = 'points'
  if (winner === -1) {
    // Out of time: both sides break off. Whoever is in better shape "won".
    const h0 = sideHealth(F, 0), h1 = sideHealth(F, 1)
    how = 'standoff'
    rec(-1, `Neither side can finish it. They break apart${Math.abs(h0 - h1) > 0.2 ? `, ${h0 > h1 ? sideName(F, 0) : sideName(F, 1)} with the better of it` : ''}.`, 0.3, 'standoff')
    return { winner: h0 > h1 + 0.2 ? 0 : h1 > h0 + 0.2 ? 1 : -1, fighters: F, beats, exchanges: ctx.exchange, how, ended }
  }
  const losers = F.filter((f) => f.side !== winner)
  if (losers.some((f) => f.outState === 'captured')) ended = 'capture'
  else if (losers.some((f) => f.outState === 'controlled')) ended = 'control'
  how = losers.every((f) => f.outState === 'fled') ? 'fled' : losers.some((f) => f.outState === 'yield') ? 'yield' : 'down'
  return { winner, fighters: F, beats, exchanges: ctx.exchange, how, ended }
}

interface Ctx {
  w: World
  r: Rng
  F: F[]
  rec: (by: number, x: string, wt: number, fx?: string, tgt?: number) => void
  o: FightOpts
  night: boolean
  exchange: number
}

function sideDone(F: F[], side: number): boolean {
  return F.every((f) => f.side !== side || f.outState)
}
function sideHealth(F: F[], side: number): number {
  const s = F.filter((f) => f.side === side)
  return s.reduce((t, f) => t + (f.outState && f.outState !== 'fled' ? 0 : Math.max(0, f.hp) / f.hpMax), 0) / Math.max(1, s.length)
}
function sideName(F: F[], side: number): string {
  const s = F.filter((f) => f.side === side && !f.extra)
  return s.length ? s[0].token : side === 0 ? 'the attackers' : 'the defenders'
}
function dist(a: F, b: F): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function speedOf(f: F): number {
  let s = f.attrs.agi
  if (f.speed) s *= f.speed.mult
  if (f.transformed) s *= Math.sqrt(f.transformed.p)
  for (const d of f.debuffs) if (d.stat === 'speed') s *= d.mult
  return s
}

function initiative(ctx: Ctx, f: F): number {
  return speedOf(f) * 0.45 + f.attrs.refl * 0.55 + (f.sense ? 20 * f.sense.mult : 0) + ctx.r.next() * 25
}

/* ================= Damage ================= */

/** Aura as fighting power: square root of output, so a fighter with four
 *  times the aura hits about twice as hard. */
function auraPow(f: F): number {
  if (!f.nen || f.sealed > 0 || f.zetsuAfter) return 0
  let x = 1.5 * Math.sqrt(f.out)
  if (f.aura < f.out * 0.5) x *= 0.5
  for (const d of f.debuffs) if (d.stat === 'output') x *= d.mult
  return x
}

function attackPower(f: F, mult: number, o: { weapon?: WeaponDef; ko?: boolean; hatsu?: boolean } = {}): number {
  const wpn = o.weapon || f.weapon
  let phys = (f.attrs.str * 0.6 + f.skill * 0.4) * (wpn.mult || 0) + wpn.fixed
  if (wpn.skill === 'firearms') phys = wpn.fixed + f.skill * 0.15
  const ap = auraPow(f)
  let off = f.stance === 'ko' || o.ko ? 1 : f.stance === 'zetsu' || f.stance === 'none' ? 0 : f.off
  if (o.hatsu) off = Math.max(off, 0.65)
  let aura = ap * off * 2
  if (wpn.skill !== 'unarmed' && wpn.skill !== 'firearms') aura *= wpn.shu ? 0.6 + 0.6 * (f.tech.shu || 0) / 100 : 0.3
  if (wpn.skill === 'firearms') aura = 0
  if (o.ko) aura *= 1.6 + (f.tech.ko || 0) / 100
  let a = (phys + aura) * mult
  for (const b of f.buffs) if (!b.stat || b.stat === 'power' || b.stat === 'all') a *= b.mult
  if (f.transformed) a *= f.transformed.p
  for (const d of f.debuffs) if (d.stat === 'power') a *= d.mult
  return Math.max(1, a)
}

function defencePower(f: F): number {
  const ap = auraPow(f)
  let d = f.attrs.tou * 0.5
  if (f.stance === 'ko') return d * 0.6
  if (f.stance === 'zetsu' || f.stance === 'none') return d
  const def = 1 - f.off
  let aura = ap * def * 2
  if (f.stance === 'ken') aura *= 1.25 + (f.tech.ken || 0) / 200
  if (f.stance === 'ten') aura *= 0.6
  if (f.tech.ryu) aura *= 1 + f.tech.ryu / 600
  d += aura
  for (const b of f.buffs) if (b.stat === 'defense' || b.stat === 'all') d *= b.mult
  if (f.transformed) d *= Math.sqrt(f.transformed.p)
  return d
}

interface HitRes { d: number; fr: number; wound: string | null; broke: boolean; part?: BodyPart; killed: boolean }

function strike(ctx: Ctx, a: F, b: F, o: { mult?: number; pBonus?: number; pierce?: boolean; sure?: boolean; ko?: boolean; hatsu?: Hatsu; ranged?: boolean; fromSummon?: boolean; area?: boolean; weapon?: WeaponDef }): HitRes | null {
  const { r } = ctx
  const wpn = o.weapon || a.weapon
  const d0 = dist(a, b)
  let p = 0.68 + (a.skill - 50) / 400 + (speedOf(a) - speedOf(b)) / 260 + (a.attrs.senses - 50) / 900 + (wpn.acc || 0)
  if (a.p) p += woundMods(a.p).acc
  if (b.bound > 0 || b.stun > 0 || b.outState === 'down') p = 1
  if (o.sure) p = 1
  p += o.pBonus || 0
  if (a.sense) p += 0.08 * a.sense.mult
  if (b.sense) p -= 0.16 * b.sense.mult
  for (const d of b.debuffs) if (d.stat === 'speed') p += 0.05
  if (b.stealth > 0) p -= 0.1
  if (o.hatsu && !b.known.has(o.hatsu.id)) p += 0.12
  if (o.hatsu && hasCondK(o.hatsu, 'named')) p -= 0.06
  if (o.ranged && d0 > MID) p -= 0.1
  if (b.summons.length && !o.area) p -= 0.04
  if (b.p && b.p.flags.clones) p -= 0.15
  if (p < 1) p = Math.max(0.08, Math.min(0.97, p))
  if (r.next() > p) return null
  let A = attackPower(a, o.mult ?? 1, { weapon: wpn, ko: o.ko, hatsu: !!o.hatsu })
  if (o.hatsu && !b.known.has(o.hatsu.id)) A *= 1.15
  let D = defencePower(b)
  if (o.pierce) D *= 0.55
  let dmg = (A * A) / (A + D) * 0.45 * (0.78 + r.next() * 0.44)
  if (b.shield) dmg *= b.shield.mult
  if (b.stance === 'ken' && !o.pierce) dmg *= 0.9
  if (ctx.o.intentA === 'spar' || ctx.o.arena) dmg *= 0.8
  dmg = Math.max(1, Math.round(dmg))
  b.hp -= dmg
  b.taken += dmg
  a.dealt += dmg
  b.tookHit = true
  if (!o.ranged && !o.fromSummon && d0 <= MELEE + 1) b.touched.add(a.i), a.touched.add(b.i)
  if (wpn.poison && !b.nen) b.poison += 1
  if (wpn.poison && b.nen) b.poison += 0.3
  const fr = dmg / b.hpMax
  let wound: string | null = null, part: BodyPart | undefined
  let broke = false
  if (b.charging && fr >= 0.12) { b.charging = null; broke = true }
  if (b.koCharge && fr >= 0.12) { b.koCharge = false; broke = true }
  if (fr >= 0.13 && b.p) {
    const lethalCap = ctx.o.intentA === 'spar' || ctx.o.arena ? 0.3 : fr
    const wd = addWound(ctx.w, b.p, lethalCap, a.p?.id)
    if (wd) { wound = woundName(wd); part = wd.part }
  }
  // Hakoware: every blow is a loan.
  if (o.hatsu?.effects.some((e) => e.k === 'debt')) b.debt += dmg * 2.5
  const killed = checkDown(ctx, b, a)
  return { d: dmg, fr, wound, broke, part, killed }
}

function tail(ctx: Ctx, res: HitRes, b?: F): string {
  let s = `(${res.d})`
  if (res.wound && b) s += ` ${b.token}: ${res.wound}.`
  else if (res.wound) s += ` ${res.wound[0].toUpperCase()}${res.wound.slice(1)}.`
  if (res.broke) s += ' The charge is broken.'
  return s
}

function checkDown(ctx: Ctx, b: F, by?: F): boolean {
  if (b.outState || b.hp > 0) return false
  b.outState = 'down'
  b.killedBy = by?.i
  return true
}

/* ================= Status ================= */

function tickStatus(f: F) {
  if (f.bound > 0) f.bound--
  if (f.stun > 0) f.stun--
  if (f.sealed > 0) f.sealed--
  if (f.stealth > 0) f.stealth--
  f.buffs = f.buffs.filter((b) => --b.dur > 0)
  f.debuffs = f.debuffs.filter((b) => --b.dur > 0)
  if (f.shield && --f.shield.dur <= 0) f.shield = null
  if (f.speed && --f.speed.dur <= 0) f.speed = null
  if (f.sense && --f.sense.dur <= 0) f.sense = null
  // Hakoware: interest compounds, and when the debt outgrows the aura, the
  // debtor goes bankrupt and is forced into Zetsu.
  if (f.debt > 0) {
    f.debt *= 1.1
    if (f.nen && f.debt > f.aura && f.sealed < 50) {
      f.sealed = 999
      f.stance = 'zetsu'
      f.aura = 0
    }
  }
}

/* ================= AI ================= */

function enemies(ctx: Ctx, f: F): F[] {
  return ctx.F.filter((g) => g.side !== f.side && !g.outState)
}
function allies(ctx: Ctx, f: F): F[] {
  return ctx.F.filter((g) => g.side === f.side && g !== f && !g.outState)
}

function threatOf(g: F): number {
  return attackPower(g, 1) + auraPow(g) + g.summons.length * 10
}

function pickTarget(ctx: Ctx, f: F): F | null {
  const es = enemies(ctx, f)
  if (!es.length) return null
  // Protecting someone: go for whoever is closest to them.
  if (f.protect != null) {
    const ward = ctx.F.find((g) => g.p?.id === f.protect && g.side === f.side)
    if (ward && !ward.outState) {
      es.sort((a, b) => dist(a, ward) - dist(b, ward))
      return es[0]
    }
  }
  // Keep pressing the same target most of the time; allies converge.
  if (f.lastTarget != null) {
    const t = ctx.F[f.lastTarget]
    if (t && !t.outState && ctx.r.chance(0.75)) return t
  }
  const aggr = f.p ? f.p.facets.aggression / 100 : 0.5
  let best: F | null = null, bs = -1e9
  for (const g of es) {
    let s = -dist(f, g) * 0.6 + (1 - g.hp / g.hpMax) * 40 * aggr + threatOf(g) * 0.05 + ctx.r.next() * 15
    if (f.p && g.p && f.p.rel[g.p.id]) s += Math.max(0, -f.p.rel[g.p.id].aff) * 0.3
    if (f.p && g.p) for (const v of f.p.nen.vows) if (v.person === g.p.id || (v.org != null && g.p.orgs.some((m) => m.org === v.org))) s += 60
    if (s > bs) { bs = s; best = g }
  }
  return best
}

function canUse(ctx: Ctx, f: F, h: Hatsu, tgt: F | null): boolean {
  if (!f.nen || f.sealed > 0 || f.zetsuAfter || h.passive) return false
  const cost = hatsuCost(f, h)
  if (f.aura < cost) return false
  const uses = f.used[h.id] || 0
  const isEffect = (k: string) => h.effects.some((e) => e.k === k)
  if (isEffect('transform') && (f.transformed || uses >= 1)) return false
  if (isEffect('shield') && f.shield) return false
  if (isEffect('speed') && f.speed && !isEffect('damage')) return false
  if (isEffect('sense') && f.sense && !isEffect('damage') && !isEffect('reveal')) return false
  if (isEffect('summon') && f.summons.length && !isEffect('damage')) return false
  if (isEffect('heal') && !h.effects.some((e) => e.k === 'damage') && f.hp / f.hpMax > 0.6 && !allies(ctx, f).some((a) => a.hp / a.hpMax < 0.45)) return false
  if (uses >= (isEffect('control') || isEffect('steal') || isEffect('contract') ? 2 : 4)) return false
  for (const c of h.conds) if (!condOk(ctx, f, h, c, tgt)) return false
  return true
}

function condOk(ctx: Ctx, f: F, h: Hatsu, c: HatsuCond, tgt: F | null): boolean {
  switch (c.k) {
    case 'touch_first': return !!tgt && f.touched.has(tgt.i)
    case 'explain': return !!tgt && f.explained.has(tgt.i)
    case 'after_hit': return f.tookHit && f.taken > f.hpMax * 0.15
    case 'daylight': return !ctx.night
    case 'once_per_target': return !!tgt && !(f.p && f.p.flags[`once:${h.id}:${tgt.p?.id ?? tgt.i}`])
    case 'cooldown': case 'time_limit': return !(f.used[h.id] > 0)
    case 'emotion': return !!f.p && (f.p.mood.anger > 30 || f.hp / f.hpMax < 0.5 || f.p.key === 'kurapika')
    case 'close_range': return !!tgt && dist(f, tgt) <= 4.5
    case 'consent': return !!tgt && (tgt.bound > 0 || tgt.outState === 'down' || tgt.hp / tgt.hpMax < 0.25)
    case 'target_only': {
      if (!tgt || !tgt.p) return false
      const okOrg = c.org != null && (c.org === -1 ? tgt.p.orgs.some((m) => ctx.w.orgs[m.org]?.key === 'troupe') : tgt.p.orgs.some((m) => m.org === c.org))
      const okPerson = !!c.people && c.people.includes(tgt.p.id)
      return okOrg || okPerson
    }
    case 'aura_all': return f.aura > f.auraMax * 0.15 && (f.hp / f.hpMax < 0.5 || ctx.exchange > 6)
    case 'sight': return true
    default: return true
  }
}

function hatsuCost(f: F, h: Hatsu): number {
  if (hasCondK(h, 'aura_all')) return f.out * 0.5
  const k = h.effects[0]?.k
  const base = k === 'transform' ? 2.2 : k === 'control' ? 2.5 : k === 'summon' ? 2 : k === 'bind' ? 1.8 : k === 'damage' ? 1.6 : 1.2
  return f.out * base * 0.6
}

function hatsuScore(ctx: Ctx, f: F, h: Hatsu, tgt: F): number {
  const hp = f.hp / f.hpMax, thp = tgt.hp / tgt.hpMax
  let s = 0
  for (const e of h.effects) {
    switch (e.k) {
      case 'damage': s += 2 + e.p + (tgt.bound > 0 || tgt.stun > 0 ? 1.5 : 0) + (e.range === 'melee' && dist(f, tgt) > 6 ? -1.5 : 0) + (e.range === 'area' && enemies(ctx, f).length > 2 ? 1.5 : 0); break
      case 'bind': s += f.intent === 'capture' ? 5 : thp < 0.6 ? 2.5 : 1.6; break
      case 'control': s += thp < 0.5 || tgt.bound > 0 ? 4 : 2; break
      case 'heal': s += hp < 0.4 ? 6 : allies(ctx, f).some((a) => a.hp / a.hpMax < 0.4) ? 4 : 0.3; break
      case 'transform': s += ctx.exchange < 5 ? 4 : 2.5; break
      case 'shield': s += hp < 0.6 ? 2.5 : 1; break
      case 'summon': s += 2.8; break
      case 'speed': s += 2.6; break
      case 'sense': s += 2; break
      case 'debuff': case 'curse': s += 2; break
      case 'seal': s += 2.6; break
      case 'contract': s += tgt.bound > 0 ? 5 : 0.5; break
      case 'reveal': s += f.revealed.has(tgt.i) ? 0 : 1.8; break
      case 'teleport': s += f.morale < 25 ? 4 : dist(f, tgt) > 8 ? 1.8 : 0.4; break
      case 'stealth': s += f.stealth ? 0 : 1.4; break
      case 'debt': s += tgt.debt > 0 ? 1.5 : 2.5; break
      case 'drain': s += 1.8; break
      case 'explode': s += tgt.touched.has(f.i) || f.touched.has(tgt.i) ? (tgt.bomb ? 0 : 4) : 0; break
      case 'clone': s += 1.4; break
      default: s += 0.3
    }
  }
  // Vows make an ability more tempting against its target.
  if (hasCondK(h, 'target_only')) s += 3
  // Desperation, or a fighter who simply loves their ability.
  if (hp < 0.4) s += 1
  return s * (0.6 + ctx.r.next() * 0.8) * (0.7 + hatsuPower(ctx.w, f.p!, h) * 0.3)
}

function turn(ctx: Ctx, f: F) {
  const { r, rec } = ctx
  if (f.bound > 0) {
    // Struggle against the hold.
    if (r.chance(0.15 + (f.attrs.str + auraPow(f)) / 600)) { f.bound = 0; rec(f.i, `${f.token} tears free.`, 0.2, 'free') }
    else rec(f.i, `${f.token} strains against the hold.`, 0.05, 'bound')
    return
  }
  if (f.stun > 0) { rec(f.i, `${f.token} is still reeling.`, 0.03, 'stun'); return }
  const tgt = pickTarget(ctx, f)
  if (!tgt) return
  f.lastTarget = tgt.i
  // Finishing a charge.
  if (f.charging) {
    const h = f.charging.h
    f.charging = null
    useHatsu(ctx, f, h, tgt, true)
    return
  }
  // Stance: Ryu-capable fighters lean into offence when attacking and defence
  // when outmatched; others hold Ren, and switch to Ken when they are losing.
  if (f.nen && !f.sealed && !f.zetsuAfter) {
    const outmatched = threatOf(tgt) > threatOf(f) * 1.3
    f.stance = f.aura < f.out * 0.4 ? 'ten' : outmatched && f.tech.ken > 25 && r.chance(0.55) ? 'ken' : 'ren'
    f.off = f.tech.ryu > 20 ? (outmatched ? 0.4 : 0.62) : 0.5
    // Gyo when an opponent has shown, or might have, hidden tricks.
    f.gyo = f.tech.gyo > 25 && (r.chance(0.35) || tgt.stealth > 0)
  }
  const d = dist(f, tgt)
  // Hatsu
  const hs = f.p && f.nen ? f.p.nen.hatsu.concat(f.p.nen.stolen).filter((h) => canUse(ctx, f, h, tgt)) : []
  const pull = f.p ? 0.4 + (f.p.facets.aggression + f.p.facets.pride) / 600 + (f.hp / f.hpMax < 0.5 ? 0.2 : 0) : 0
  if (hs.length && r.chance(Math.min(0.9, pull + 0.15))) {
    let best: Hatsu | null = null, bs = 0
    for (const h of hs) { const s = hatsuScore(ctx, f, h, tgt); if (s > bs) { bs = s; best = h } }
    if (best && bs > 1.5) {
      if (hasCondK(best, 'charge') || hasCondK(best, 'stillness')) {
        f.charging = { h: best, n: 1 }
        rec(f.i, hasCondK(best, 'named') ? `${f.token} plants their feet and starts the chant for ${quote(best)}.` : `${f.token} goes still, gathering aura for ${quote(best)}.`, 0.25, 'charge', tgt.i)
        return
      }
      useHatsu(ctx, f, best, tgt, false)
      return
    }
  }
  // Rules that need explaining get explained (Genthru's Countdown).
  if (f.p && f.nen && d < 6) {
    const ex = f.p.nen.hatsu.find((h) => hasCondK(h, 'explain') && !f.explained.has(tgt.i) && (!hasCondK(h, 'touch_first') || f.touched.has(tgt.i)))
    if (ex && r.chance(0.6)) {
      f.explained.add(tgt.i)
      rec(f.i, `${f.token} tells ${tgt.token} exactly how ${quote(ex)} works. Knowing the rule is part of the rule.`, 0.25, 'explain', tgt.i)
      return
    }
  }
  // Move into range for the weapon.
  const wantRange = f.weapon.range === 'melee' ? MELEE : f.weapon.range === 'mid' ? 12 : 25
  const step = 4 + speedOf(f) / 10
  if (d > wantRange + 0.5) {
    moveToward(f, tgt, Math.min(step, d - wantRange + 0.5))
    if (dist(f, tgt) > wantRange + 0.5) {
      if (r.chance(0.35)) rec(f.i, `${f.token} closes in on ${tgt.token}.`, 0.03, 'move', tgt.i)
      return
    }
  } else if (f.weapon.range !== 'melee' && d < 5 && speedOf(f) > speedOf(tgt) * 0.9 && r.chance(0.5)) {
    moveAway(f, tgt, step * 0.6)
  }
  // Ko: everything in one spot, when the opening is there.
  if (f.nen && f.tech.ko > 20 && !f.sealed && (tgt.bound > 0 || tgt.stun > 0 || r.chance(0.08 + (f.p?.facets.aggression ?? 50) / 900)) && f.aura > f.out * 1.5 && dist(f, tgt) <= MELEE + 0.5) {
    f.stance = 'ko'
    f.aura -= f.out * 1.2
    const res = strike(ctx, f, tgt, { mult: 1.3, ko: true, pBonus: tgt.bound > 0 ? 0 : -0.1 })
    if (res) rec(f.i, `${f.token} puts everything into one Ko blow${tgt.stance === 'ken' ? ', straight through the Ken' : ''}. ${tail(ctx, res, tgt)}`, 0.55 + res.fr, 'ko', tgt.i)
    else rec(f.i, `${f.token} commits to a Ko blow and misses. For a moment, every part of them but one fist is bare.`, 0.35, 'ko-miss', tgt.i)
    return
  }
  // In: a hidden attack.
  if (f.nen && f.tech.in > 25 && r.chance(0.12) && !f.sealed) {
    if (!tgt.gyo) {
      const res = strike(ctx, f, tgt, { mult: 1.15, pBonus: 0.25, pierce: true })
      if (res) { rec(f.i, `${f.token} hides an attack with In. ${tgt.token} never sees it. ${tail(ctx, res, tgt)}`, 0.4 + res.fr, 'in', tgt.i); return }
    } else {
      rec(f.i, `${f.token} hides an attack with In. ${tgt.token} catches it with Gyo.`, 0.2, 'gyo', tgt.i)
      return
    }
  }
  const ranged = f.weapon.range !== 'melee'
  const res = strike(ctx, f, tgt, { ranged })
  if (res) {
    const verb = f.weapon.key === 'fists' ? (res.fr > 0.2 ? 'lands a heavy blow on' : 'hits') : f.weapon.verb
    rec(f.i, `${f.token} ${verb} ${tgt.token}. ${tail(ctx, res, tgt)}`, res.fr + (res.wound ? 0.25 : 0), ranged ? 'shot' : 'hit', tgt.i)
  } else if (r.chance(0.4)) {
    rec(f.i, `${f.token} ${ranged ? 'fires' : 'swings'} at ${tgt.token}${r.chance(0.5) ? ', who is not there' : ' and misses'}.`, 0.03, 'miss', tgt.i)
  }
}

function moveToward(f: F, t: F, step: number) {
  const d = Math.max(0.01, dist(f, t))
  f.x += (t.x - f.x) / d * step
  f.y += (t.y - f.y) / d * step
}
function moveAway(f: F, t: F, step: number) {
  const d = Math.max(0.01, dist(f, t))
  f.x = Math.max(0, Math.min(40, f.x - (t.x - f.x) / d * step))
  f.y = Math.max(0, Math.min(24, f.y - (t.y - f.y) / d * step))
}

function quote(h: Hatsu) {
  return `"${h.name}"`
}

/* ================= Using a Hatsu ================= */

function useHatsu(ctx: Ctx, f: F, h: Hatsu, tgt: F, charged: boolean) {
  const { w, r, rec } = ctx
  const p = f.p!
  const pow = hatsuPower(w, p, h)
  const first = !tgt.known.has(h.id)
  f.aura -= hatsuCost(f, h)
  f.used[h.id] = (f.used[h.id] || 0) + 1
  f.usedHatsu.add(h.id)
  h.uses++
  if (hasCondK(h, 'once_per_target')) p.flags[`once:${h.id}:${tgt.p?.id ?? tgt.i}`] = 1
  if (hasCondK(h, 'death_penalty') && !hasCondK(h, 'target_only')) f.staked = h
  if (hasCondK(h, 'self_harm')) { const sd = Math.round(f.hpMax * 0.04); f.hp -= sd }
  if (hasCondK(h, 'life_cost')) p.nen.lifeSpent += 30
  if (h.from != null) f.attrs.str *= 0.97
  const allSee = (k = h.id) => { for (const g of ctx.F) if (g.p && g !== f) g.known.add(k) }
  let said = false
  const say = (x: string, wt: number, fx: string) => { rec(f.i, x, wt, fx, tgt.i); said = true }
  for (const e of h.effects) {
    const P = e.p * pow
    switch (e.k) {
      case 'damage': {
        const area = e.range === 'area'
        const ranged = e.range === 'mid' || e.range === 'far' || area
        if (!ranged && dist(f, tgt) > MELEE + 1.5) moveToward(f, tgt, Math.min(dist(f, tgt) - MELEE, 6 + speedOf(f) / 8))
        if (!ranged && dist(f, tgt) > MELEE + 1.5) { say(`${f.token} lunges with ${quote(h)} and cannot reach ${tgt.token}.`, 0.15, 'miss'); break }
        let aura = 1
        if (hasCondK(h, 'aura_all')) { aura = 1 + f.aura / Math.max(1, f.auraMax) * 2; f.aura = 0 }
        const targets = area ? enemies(ctx, f).filter((g) => dist(g, tgt) < 12).slice(0, 8) : [tgt]
        const parts: string[] = []
        for (const g of targets) {
          const res = strike(ctx, f, g, { mult: 1.2 * P * aura * (area ? 0.8 : 1) * (charged ? 1.15 : 1), hatsu: h, ranged, area, pBonus: charged ? -0.04 : 0.02 })
          if (res) parts.push(`${g.token} ${tail(ctx, res)}`)
        }
        if (parts.length) say(`${f.token} ${first ? 'unleashes' : 'uses'} ${quote(h)}. ${parts.join(' ')}${first ? '' : ''}`, 0.5 + targets.length * 0.1, area ? 'area' : 'hatsu')
        else say(`${f.token} uses ${quote(h)}, and ${tgt.token} gets clear of it.`, 0.2, 'miss')
        break
      }
      case 'bind': {
        const pb = 0.32 + 0.2 * P + (tgt.hp / tgt.hpMax < 0.5 ? 0.18 : 0) + (speedOf(f) - speedOf(tgt)) / 300 - (tgt.sense ? 0.15 : 0) + (first ? 0.12 : 0)
        if (r.chance(Math.max(0.06, Math.min(0.93, pb)))) {
          tgt.bound = Math.max(tgt.bound, (e.dur || 2) + (P > 2 ? 1 : 0))
          say(`${f.token} catches ${tgt.token} with ${quote(h)}. ${tgt.token} cannot move.`, 0.6, 'bind')
          if (f.intent === 'capture' && P > 1.4) {
            tgt.outState = 'captured'
            rec(f.i, `${tgt.token} is held fast. It is over.`, 0.7, 'capture', tgt.i)
          }
        } else say(`${f.token} reaches for ${tgt.token} with ${quote(h)}. ${tgt.token} twists away.`, 0.2, 'miss')
        break
      }
      case 'seal': {
        if (tgt.bound > 0 || r.chance(0.3 + 0.1 * P)) {
          tgt.sealed = Math.max(tgt.sealed, (e.dur || 3) + 2)
          tgt.stance = 'zetsu'
          if (!said) say(`${quote(h)} forces ${tgt.token} into Zetsu. Their aura is gone.`, 0.7, 'seal')
          else rec(f.i, `${tgt.token} is forced into Zetsu.`, 0.5, 'seal', tgt.i)
        }
        break
      }
      case 'control': {
        const pc = 0.18 + 0.2 * P + (f.attrs.int - tgt.attrs.int) / 300 + (tgt.hp / tgt.hpMax < 0.4 ? 0.22 : 0) + (tgt.bound > 0 ? 0.3 : 0) - (tgt.p ? tgt.p.mind.will / 600 : 0)
        if (r.chance(Math.max(0.04, Math.min(0.85, pc)))) {
          tgt.outState = 'controlled'
          tgt.controlledBy = f.i
          say(`${f.token} lands ${quote(h)}. ${tgt.token} stops. Their eyes go empty.`, 1, 'control')
        } else say(`${f.token} tries ${quote(h)} on ${tgt.token} and cannot make it take.`, 0.25, 'miss')
        break
      }
      case 'heal': {
        const who = f.hp / f.hpMax < 0.6 ? f : allies(ctx, f).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] || f
        const amt = Math.round(who.hpMax * 0.22 * Math.min(2, P))
        who.hp = Math.min(who.hpMax, who.hp + amt)
        if (who.p) for (const x of who.p.wounds) if (x.t === w.t) { x.bleed = false; x.treated = true }
        say(`${f.token} uses ${quote(h)} on ${who === f ? 'themselves' : who.token} (+${amt}).`, 0.35, 'heal')
        break
      }
      case 'transform': {
        f.transformed = { h, dur: e.dur || 4, p: 1 + 0.5 * P }
        if (p.key === 'kurapika' || h.name === 'Emperor Time') p.flags.emperor = true
        say(`${f.token} ${first ? 'reveals' : 'uses'} ${quote(h)}. ${h.desc.split('.')[0]}.`, 0.5, 'transform')
        break
      }
      case 'shield': f.shield = { mult: Math.max(0.3, 0.7 / Math.sqrt(P)), dur: e.dur || 3 }; if (!said) say(`${f.token} raises ${quote(h)}. Blows start to glance off.`, 0.3, 'shield'); break
      case 'buff': f.buffs.push({ mult: 1 + 0.25 * P, dur: e.dur || 3, stat: e.stat || 'power' }); if (!said) say(`${f.token} uses ${quote(h)} and grows stronger.`, 0.3, 'buff'); break
      case 'speed': f.speed = { mult: 1 + 0.45 * P, dur: e.dur || 3 }; if (!said) say(`${f.token} uses ${quote(h)}. They move faster than the eye can follow.`, 0.4, 'speed'); break
      case 'sense': f.sense = { mult: 0.6 + 0.4 * P, dur: e.dur || 3 }; if (!said) say(`${f.token} uses ${quote(h)} and starts reading ${tgt.token}'s every move.`, 0.3, 'sense'); break
      case 'debuff': tgt.debuffs.push({ mult: Math.max(0.4, Math.min(0.95, e.p / Math.max(0.7, pow))), dur: e.dur || 3, stat: e.stat || 'output' }); if (!said) say(`${quote(h)} takes hold of ${tgt.token}. Everything they do now costs more.`, 0.35, 'debuff'); break
      case 'curse': tgt.debuffs.push({ mult: Math.max(0.5, 0.92 - 0.08 * P), dur: 99, stat: 'power' }); if (!said) say(`${f.token} lays ${quote(h)} on ${tgt.token}.`, 0.4, 'curse'); break
      case 'summon': f.summons.push({ name: `${f.token}'s ${h.name}`, p: P, dur: e.dur || 4 }); if (!said) say(`${f.token} calls out ${quote(h)}. Something else joins the fight.`, 0.4, 'summon'); break
      case 'stealth': f.stealth = 3; if (!said) say(`${f.token} uses ${quote(h)} and vanishes from sight.`, 0.3, 'stealth'); break
      case 'clone': f.stealth = 2; if (!said) say(`${quote(h)}: suddenly there is more than one ${f.token}.`, 0.3, 'clone'); break
      case 'teleport': {
        if (f.morale < 25) { f.outState = 'fled'; say(`${f.token} steps through ${quote(h)} and is simply gone.`, 0.6, 'teleport') }
        else { f.x = tgt.x - 1.5; f.y = tgt.y; f.stealth = 1; if (!said) say(`${f.token} steps through ${quote(h)} and comes out beside ${tgt.token}.`, 0.35, 'teleport') }
        break
      }
      case 'reveal': {
        f.revealed.add(tgt.i)
        if (tgt.p) for (const th of tgt.p.nen.hatsu.concat(tgt.p.nen.stolen)) f.known.add(th.id)
        f.sense = { mult: Math.max(f.sense?.mult ?? 0, 0.6), dur: 3 }
        if (!said) say(`${f.token} uses ${quote(h)} and reads everything ${tgt.token} knows how to do.`, 0.4, 'reveal')
        break
      }
      case 'drain': {
        const amt = Math.min(tgt.aura, tgt.out * 1.2 * P)
        tgt.aura -= amt; f.aura = Math.min(f.auraMax, f.aura + amt * 0.7)
        if (!said) say(`${quote(h)} drinks ${tgt.token}'s aura.`, 0.35, 'drain')
        break
      }
      case 'debt': {
        if (!said) {
          const res = strike(ctx, f, tgt, { mult: 0.9 * pow, hatsu: h })
          if (res) say(`${f.token} lands a punch and lends ${tgt.token} aura through ${quote(h)}. The interest starts now. ${tail(ctx, res, tgt)}`, 0.4, 'debt')
          else say(`${f.token} swings, and ${tgt.token} avoids taking the loan.`, 0.15, 'miss')
        }
        break
      }
      case 'explode': {
        if (!tgt.bomb) {
          tgt.bomb = { by: f.i, t: ctx.exchange + 4, p: P }
          if (!said) say(`${quote(h)}: a bomb is planted in ${tgt.token}. It goes off in four exchanges unless they touch ${f.token} and say the words.`, 0.6, 'bomb')
        }
        break
      }
      case 'contract': {
        if (tgt.bound > 0 || tgt.outState === 'captured') {
          tgt.sealed = 999
          tgt.morale -= 40
          if (tgt.p) tgt.p.flags.judgment = f.p!.id
          say(`${f.token} drives ${quote(h)} into ${tgt.token}'s heart and states the rule. Break it, and the chain kills.`, 0.9, 'contract')
          if (tgt.outState !== 'captured') { tgt.outState = 'captured'; rec(f.i, `${tgt.token} has lost.`, 0.6, 'capture', tgt.i) }
        }
        break
      }
      case 'steal': case 'absorb': case 'utility': case 'poison':
        if (e.k === 'poison') tgt.poison += P
        break
    }
  }
  if (!said) rec(f.i, `${f.token} uses ${quote(h)}.`, 0.2, 'hatsu', tgt.i)
  // Everyone watching now knows this one.
  if (first) allSee()
}

/* ================= Morale ================= */

function morale(ctx: Ctx, f: F) {
  const { r, rec, o } = ctx
  if (f.outState) return
  const es = enemies(ctx, f)
  if (!es.length) return
  const myHp = f.hp / f.hpMax
  const theirPow = es.reduce((s, g) => s + threatOf(g) * (g.hp / g.hpMax), 0)
  const ourPow = threatOf(f) * myHp + allies(ctx, f).reduce((s, g) => s + threatOf(g) * (g.hp / g.hpMax), 0)
  const ratio = theirPow / Math.max(1, ourPow)
  f.morale += (myHp < 0.5 ? -6 : 0) + (ratio > 1.6 ? -5 : ratio < 0.7 ? 3 : 0) - (f.taken > f.hpMax * 0.6 ? 4 : 0)
  if (f.p) {
    if (f.p.flags.illumiNeedle && ratio > 1.15) f.morale -= 30
    if (f.p.facets.bravery > 85) f.morale += 3
    for (const v of f.p.nen.vows) if (es.some((g) => g.p && (v.person === g.p.id || (v.org != null && g.p.orgs.some((m) => m.org === v.org))))) f.morale += 8
  }
  if (f.intent === 'war' && f.p?.species === 'ant') f.morale += 5
  const proud = f.p ? f.p.facets.pride > 80 || f.p.facets.bravery > 90 : false
  const zold = f.p ? f.p.orgs.some((m) => ctx.w.orgs[m.org]?.key === 'zoldyck') : false
  // Zoldyck rule: never fight what you cannot beat.
  const giveUp = f.morale < 20 || (zold && ratio > 2 && myHp < 0.7) || (f.p?.flags.illumiNeedle && ratio > 1.3 && myHp < 0.85)
  if (!giveUp) return
  if (o.intentA === 'spar' || o.arena || f.intent === 'duel') {
    if (!proud || myHp < 0.25) { f.outState = 'yield'; rec(f.i, `${f.token} raises a hand. Enough.`, 0.6, 'yield') }
    return
  }
  if (f.intent === 'war' && f.p?.species === 'ant') return
  if (f.bound > 0) return
  const fastest = es.reduce((m, g) => Math.max(m, speedOf(g) + (g.tech?.en > 30 ? 25 : 0)), 0)
  const pf = 0.32 + (speedOf(f) - fastest) / 160 + (f.tech.zetsu ? 0.08 : 0) + (f.stealth ? 0.2 : 0)
  if (r.chance(Math.max(0.05, Math.min(0.9, pf)))) {
    f.outState = 'fled'
    rec(f.i, zold ? `${f.token} decides this is a fight they cannot win, and leaves.` : `${f.token} breaks away and runs.`, 0.6, 'flee')
  } else if (!proud && r.chance(0.25)) {
    f.outState = 'yield'
    rec(f.i, `${f.token} drops to one knee and asks for their life.`, 0.6, 'yield')
  } else {
    const g = es[0]
    rec(f.i, `${f.token} tries to run. ${g.token} cuts off the way out.`, 0.35, 'cut', g.i)
  }
}

/* ================= Helpers for callers ================= */

/** Rough odds that side a beats side b, for AI decisions before a fight. */
export function odds(as: Person[], bs: Person[]): number {
  const pa = as.reduce((s, p) => s + power(p) * (p.hp / hpMax(p)), 0)
  const pb = bs.reduce((s, p) => s + power(p) * (p.hp / hpMax(p)), 0)
  const x = pa / Math.max(1, pa + pb)
  return Math.pow(x, 1.6) / (Math.pow(x, 1.6) + Math.pow(1 - x, 1.6))
}

export { TECH_INFO, NEN_TYPES, at, orgK, abilityFact, witness }
