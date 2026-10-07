/**
 * Hazards and natural disasters.
 *
 * A disaster is a moment: the quake, the wave, the eruption. A hazard is
 * what it leaves behind: fire, floodwater, rubble, ash, plague, fallout.
 * Hazards hurt whoever stands in them, kill part of the unnamed population,
 * drain wealth and stability, spread, and fade faster when people come to
 * help. The people who come are remembered for it.
 */
import { DISASTERS, HAZARDS, type DisasterKind, type HazardKind } from '../../data/hazards'
import { MOUNTAINS } from '../../data/geography'
import { L, P, log } from '../history'
import type { Hazard, Id, Person, Place, World } from '../types'
import { alive, at, rng } from '../world'
import { hpMax, isFree, nenUsable, power } from '../people/person'
import { addWound } from '../people/health'
import { remember } from '../people/memory'
import { change } from '../people/relations'
import { kill } from '../events/death'
import { startStory, endStory } from '../story/storyteller'
import { fight } from '../combat/aftermath'

/* ================= Hazards on places ================= */

export function hazardsOf(pl: Place): Hazard[] {
  return pl.hazards || []
}

/** Put a hazard on a place, or make an existing one worse. */
export function addHazard(w: World, pl: Place, k: HazardKind, sev: number, o: { ev?: Id; cal?: string } = {}): Hazard {
  if (!pl.hazards) pl.hazards = []
  if (!pl.base) pl.base = { pop: pl.pop, wealth: pl.wealth }
  let h = pl.hazards.find((x) => x.k === k && x.cal === o.cal)
  if (h) h.sev = Math.min(1, Math.max(h.sev, sev))
  else { h = { k, sev: Math.min(1, sev), t: w.t, ev: o.ev, cal: o.cal }; pl.hazards.push(h) }
  syncHazard(w, pl)
  return h
}

export function clearHazard(w: World, pl: Place, k: HazardKind) {
  if (!pl.hazards) return
  pl.hazards = pl.hazards.filter((h) => h.k !== k)
  syncHazard(w, pl)
}

/** Keep the one-number summary in step with the list. */
export function syncHazard(w: World, pl: Place) {
  const hs = pl.hazards || []
  let top: Hazard | null = null
  for (const h of hs) if (!top || h.sev > top.sev) top = h
  pl.hazard = top ? top.sev : 0
  pl.hazardKind = top ? top.k : undefined
  pl.hazardUntil = top ? w.t + 7 : 0
  if (!hs.length) delete pl.hazards
}

function dist2(a: Place, b: Place) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }

function nearestTo(w: World, pl: Place, maxTiles = 14): Place | null {
  let best: Place | null = null, bd = maxTiles * maxTiles
  for (const q of w.places) {
    if (q === pl || q.kind === 'beyond' || q.kind === 'ship' || q.features.includes('game')) continue
    const d = dist2(pl, q)
    if (d < bd) { bd = d; best = q }
  }
  return best
}

/** One day of every hazard in the world. */
export function hazardsDaily(w: World) {
  const r = rng(w)
  for (const pl of w.places) {
    if (!pl.hazards || !pl.hazards.length) continue
    const here = at(w, pl.id)
    for (const h of pl.hazards.slice()) {
      const def = HAZARDS[h.k]
      const s = h.sev
      // The people in it.
      let helpers = 0
      for (const p of here) {
        if (!p.alive) continue
        if (def.helpers.includes(p.role) || p.act.note?.startsWith('Helping')) helpers++
        if (h.k === 'ants' || p.species === 'ant' && h.k !== 'rose') continue
        const resist = nenUsable(p) ? def.nenResist : 0
        if (def.hp > 0) {
          p.hp -= hpMax(p) * def.hp * s * (1 - resist) * (0.6 + r.next() * 0.8)
          if (p.hp <= 0) {
            kill(w, p, { cause: def.death, how: `${P(p)} dies in ${def.death} at ${L(pl)}.`, ev: h.ev, quiet: !p.major && !p.owned })
            continue
          }
        }
        // A plague from beyond the lake is that disease, not an ordinary one.
        const ck = h.cal === 'zobae' ? 'zobae' : def.cond
        if (ck && !p.conds.some((c) => c.k === ck) && r.chance((def.condChance ?? 0) * s * (1 - resist * 0.5))) {
          p.conds.push({ k: ck, until: w.t + (h.cal === 'zobae' ? 200 : def.condDays ?? 20), p: (def.condP ?? 1) * (0.5 + s * 0.5), note: h.cal || h.k })
        }
      }
      if (h.k === 'frenzy') frenzyDay(w, pl, here, s)
      if (h.k === 'beast') { beastDay(w, pl, here, h); if (!pl.hazards.includes(h)) continue }
      if (h.k === 'vanishing') vanishDay(w, pl, here, s, h)
      if (h.k === 'gas') gasDay(w, pl, here, s, h)
      // The place itself.
      if (!pl.base) pl.base = { pop: pl.pop, wealth: pl.wealth }
      const relief = Math.min(0.6, helpers * 0.12)
      pl.pop = Math.max(0, pl.pop * (1 - def.pop * s * (1 - relief)))
      pl.wealth = Math.max(0.02, pl.wealth - def.wealth * s * 0.15)
      pl.unrest = Math.min(1, pl.unrest + s * 0.004 * (1 - relief))
      const n = w.nations[pl.nation]
      if (n && s > 0.4) n.stability = Math.max(0, n.stability - 0.02 * s)
      // Helpers earn something for it.
      if (helpers) for (const p of here) if (def.helpers.includes(p.role) || p.act.note?.startsWith('Helping')) {
        p.fame += 0.04 * s
        p.needs.purpose = Math.min(100, p.needs.purpose + 3)
      }
      h.helped = (h.helped || 0) + helpers
      // It spreads.
      if (def.spread && r.chance(def.spread * s)) {
        const q = nearestTo(w, pl)
        if (q && !(q.hazards || []).some((x) => x.k === h.k && x.sev >= s * 0.5)) {
          addHazard(w, q, h.k, s * 0.6, { ev: h.ev, cal: h.cal })
          if (s > 0.5) log(w, { type: 'disaster', imp: 2, at: q.id, cause: h.ev, text: `${capital(def.name)} spreads from ${L(pl)} to ${L(q)}.` })
        }
      }
      // It fades, faster with hands to help.
      h.sev -= def.decay * (1 + Math.min(1.5, helpers * 0.25))
      if (h.sev <= 0.02) {
        pl.hazards = pl.hazards.filter((x) => x !== h)
        if (h.ev != null && def.hp + def.pop > 0.003 && s > 0.1) {
          const ev = log(w, { type: 'disaster', imp: 2, at: pl.id, cause: h.ev, text: `${capital(def.name)} in ${L(pl)} is over at last.${(h.helped || 0) > 20 ? ' People came from all over to help.' : ''}` })
          endStory(w, `disaster-${h.ev}`, ev, 'It ended.')
        }
      }
    }
    syncHazard(w, pl)
    // Places recover slowly once nothing is wrong.
    if (!pl.hazards?.length && pl.base) {
      pl.pop = Math.min(pl.base.pop, pl.pop + pl.base.pop * 0.0008)
      pl.wealth = Math.min(pl.base.wealth, pl.wealth + 0.0006)
    }
  }
  // Places with no hazards still need to heal back after one is gone.
  if (w.t % 7 === 0) for (const pl of w.places) if (!pl.hazards?.length && pl.base) {
    pl.pop = Math.min(pl.base.pop, pl.pop + pl.base.pop * 0.005)
    pl.wealth = Math.min(pl.base.wealth, pl.wealth + 0.004)
    pl.unrest = Math.max(0, pl.unrest - 0.01)
    if (pl.pop >= pl.base.pop * 0.999 && pl.wealth >= pl.base.wealth - 0.001) delete pl.base
  }
}

/** Hellbell's madness, or anything like it: people in the place turn on
 *  the person next to them. */
function frenzyDay(w: World, pl: Place, here: Person[], s: number) {
  const r = rng(w)
  if (!r.chance(0.35 * s) || here.length < 2) return
  const mad = here.filter((p) => p.species === 'human' && isFree(p) && p.lastFight !== w.t && (p.conds.some((c) => c.k === 'frenzied') || r.chance(0.08 * s * (1 - p.mind.will / 150))))
  for (const a of mad.slice(0, 2)) {
    const b = r.pick(here.filter((q) => q !== a && isFree(q) && q.lastFight !== w.t))
    if (!b) continue
    if (!a.conds.some((c) => c.k === 'frenzied')) a.conds.push({ k: 'frenzied', until: w.t + 5, note: 'frenzy' })
    fight(w, { a: [a], b: [b], intentA: 'kill', place: pl.id, why: 'in the grip of the madness', record: a.major || b.major })
  }
}

/** Something that followed an expedition home. It kills, and the strong
 *  come to kill it. */
function beastDay(w: World, pl: Place, here: Person[], h: Hazard) {
  const r = rng(w)
  const hunters = here.filter((p) => isFree(p) && p.nen.awake && power(p) > 110 && p.species === 'human')
  for (const p of hunters) {
    if (!r.chance(0.04 + power(p) / 2500)) continue
    const bounty = w.flags.beastBounty as { place: Id; reward: number } | undefined
    pl.hazards = (pl.hazards || []).filter((x) => x !== h)
    p.fame += 50
    if (bounty && bounty.place === pl.id) { p.jenny += bounty.reward; delete w.flags.beastBounty }
    log(w, { type: 'calamity', imp: 5, who: [p.id], at: pl.id, cause: h.ev, text: `${P(p)} kills the thing that came home from beyond the lake, in ${L(pl)}. Nobody inside the lake had done that before.` })
    remember(w, p, { k: 'slayer', val: 70, str: 90, text: 'Killed a calamity from the Dark Continent.' })
    return
  }
  if (!r.chance(0.2 * h.sev) || !here.length) return
  const v = r.pick(here)
  if (!v.alive || v.species === 'ant') return
  if (nenUsable(v) && power(v) > 90 && r.chance(0.7)) { addWound(w, v, 0.45); v.hp = Math.max(1, v.hp - hpMax(v) * 0.5); return }
  kill(w, v, { cause: 'the thing from beyond the lake', quiet: !v.major && !v.owned, ev: h.ev, how: `The thing from beyond the lake kills ${P(v)} in ${L(pl)}.` })
}

/** Something takes people, and keeps them. */
function vanishDay(w: World, pl: Place, here: Person[], s: number, h: Hazard) {
  const r = rng(w)
  if (!r.chance(0.06 * s) || !here.length) return
  const v = r.pick(here.filter((p) => !p.major && !p.owned && p.species === 'human'))
  if (!v) return
  const home = w.dc?.calamities.find((c) => c.key === h.cal)?.region
  const dest = home ? w.places.find((q) => q.key === home) : undefined
  v.conds.push({ k: 'kept', until: -1, note: h.cal })
  v.flags.castaway = home || 'dc_shore'
  if (dest) { v.loc = dest.id; v.trip = undefined }
  log(w, { type: 'calamity', imp: 2, who: [v.id], at: pl.id, cause: h.ev, text: `${P(v)} goes missing in ${L(pl)}. There are no signs of a struggle.` })
}

/** A living gas that grants wishes and takes payment, like the thing
 *  inside Alluka Zoldyck. */
function gasDay(w: World, pl: Place, here: Person[], s: number, h: Hazard) {
  const r = rng(w)
  if (!here.length || !r.chance(0.08 * s)) return
  const wisher = r.pick(here)
  if (!wisher.alive || wisher.species !== 'human') return
  const boon = r.pick(['wealth', 'heal', 'power'] as const)
  if (boon === 'wealth') wisher.jenny += 50 + r.int(500)
  if (boon === 'heal') { wisher.hp = hpMax(wisher); wisher.wounds = wisher.wounds.filter((x) => x.perm); wisher.conds = wisher.conds.filter((c) => c.k === 'pregnant') }
  if (boon === 'power' && wisher.nen.awake) wisher.nen.lvl = Math.min(wisher.nen.cap + 5, wisher.nen.lvl + 8)
  const ev = log(w, { type: 'disaster', imp: wisher.major || wisher.owned ? 3 : 2, who: [wisher.id], at: pl.id, cause: h.ev, text: `In the haze over ${L(pl)}, ${P(wisher)} says what they want out loud, and gets it: ${boon === 'wealth' ? 'money, more than they asked for' : boon === 'heal' ? 'every wound closes' : 'their aura doubles in a night'}.` })
  const payers = here.filter((q) => q !== wisher && q.alive && q.species === 'human')
  const victim = payers.length ? r.pick(payers) : null
  if (victim) kill(w, victim, { cause: 'the living gas', ev, how: `The haze takes payment. ${P(victim)} is found twisted like wrung cloth.` })
  remember(w, wisher, { k: 'wish', val: 20, str: 70, ev, text: 'Made a wish in the haze. Someone paid for it.' })
}

/* ================= Natural disasters ================= */

function mountainNear(x: number, y: number): number {
  let m = 0
  for (const [mx, my, rr, h] of MOUNTAINS) {
    const d = Math.sqrt((x - mx) ** 2 + (y - my) ** 2)
    if (d < rr + 4) m = Math.max(m, h * (1 - d / (rr + 4)))
  }
  return m
}

const TOTAL_RATE = Object.values(DISASTERS).reduce((s, d) => s + d.rate, 0)

/** Roughly six disasters a year somewhere in the world, most of them small. */
export function disastersDaily(w: World) {
  if (w.laws.disasters === false) return
  const r = rng(w)
  if (!r.chance(TOTAL_RATE / 365)) return
  let x = r.next() * TOTAL_RATE
  let kind: DisasterKind = 'earthquake'
  for (const [k, d] of Object.entries(DISASTERS) as [DisasterKind, typeof DISASTERS[DisasterKind]][]) { x -= d.rate; if (x <= 0) { kind = k; break } }
  const def = DISASTERS[kind]
  const cands = w.places.filter((p) => p.kind !== 'beyond' && p.kind !== 'ship' && !p.features.includes('game'))
  const weights = cands.map((p) => Math.max(0, def.where({ kind: p.kind, features: p.features, port: p.port, y: p.y, mountain: mountainNear(p.x, p.y), pop: p.pop })))
  const tot = weights.reduce((s, v) => s + v, 0)
  if (tot <= 0) return
  let y = r.next() * tot
  let pl = cands[0]
  for (let i = 0; i < cands.length; i++) { y -= weights[i]; if (y <= 0) { pl = cands[i]; break } }
  const sev = 0.2 + Math.pow(r.next(), 1.6) * 0.8
  strikeDisaster(w, pl, kind, sev)
}

/** A disaster hits a place now. */
export function strikeDisaster(w: World, pl: Place, kind: DisasterKind, sev: number, cause?: Id): Id {
  const r = rng(w)
  const def = DISASTERS[kind]
  if (!pl.base) pl.base = { pop: pl.pop, wealth: pl.wealth }
  const lostPop = pl.pop * def.instant.pop * sev * sev * 0.6
  pl.pop = Math.max(0, pl.pop - lostPop)
  pl.wealth = Math.max(0.02, pl.wealth - def.instant.wealth * sev)
  pl.unrest = Math.min(1, pl.unrest + sev * 0.25)
  const n = w.nations[pl.nation]
  if (n) { n.stability = Math.max(0, n.stability - sev * 6); n.treasury -= n.gdp * sev * 0.5 }
  const deadK = Math.round(lostPop)
  // The worst of them are remembered for generations; most are local news.
  const imp = deadK >= 40 ? 5 : deadK >= 8 ? 4 : deadK >= 2 || sev > 0.7 ? 3 : 2
  const head = (sev > 0.8 ? def.text[0] : def.text[def.text.length - 1]).replace('{L}', L(pl))
  const ev = log(w, {
    type: 'disaster', imp, at: pl.id, nats: n ? [n.id] : [], cause,
    text: `${head}${deadK >= 1 ? ` Perhaps ${deadK.toLocaleString('en-US')},000 dead.` : ''}`,
  })
  if (sev > 0.5) startStory(w, 'disaster', `The ${def.name} at ${pl.name}`, [], ev, `disaster-${ev}`)
  // The named people who were there.
  const hurt: Person[] = []
  for (const p of at(w, pl.id).slice()) {
    if (!p.alive || !r.chance(def.instant.hurt * sev)) continue
    const resist = nenUsable(p) ? 0.55 : 0
    const frac = def.instant.wound * sev * (0.5 + r.next()) * (1 - resist)
    if (frac < 0.08) continue
    addWound(w, p, frac)
    p.hp -= hpMax(p) * frac
    hurt.push(p)
    if (p.hp <= -hpMax(p) * 0.3 && !nenUsable(p)) {
      kill(w, p, { cause: `the ${def.name} at ${pl.name}`, ev, how: `${P(p)} is killed in the ${def.name} at ${L(pl)}.`, quiet: !p.major && !p.owned })
    } else {
      p.hp = Math.max(1, p.hp)
      remember(w, p, { k: 'disaster', val: -30, str: 50, ev, text: `Lived through the ${def.name} at ${pl.name}.` })
      p.mood.fear = Math.min(100, p.mood.fear + 30 * sev)
    }
  }
  const named = hurt.filter((p) => p.major || p.owned)
  if (named.length) log(w, { type: 'disaster', imp: 3, who: named.map((p) => p.id), at: pl.id, cause: ev, text: `${named.map((p) => P(p)).join(', ')} ${named.length > 1 ? 'are' : 'is'} caught in it and hurt.` })
  for (const [k, sv] of def.leaves) if (r.chance(sv)) addHazard(w, pl, k, sev * (0.6 + r.next() * 0.4), { ev })
  if (sev > 0.4) callForHelp(w, pl, ev, sev)
  return ev
}

const MONSTERS = new Set<HazardKind>(['ants', 'beast', 'frenzy', 'gas', 'vanishing'])

/** Who drops everything to help. Doctors, soldiers, the kind, and Hunters
 *  for whom this is the job. */
export function callForHelp(w: World, pl: Place, ev: Id, sev: number) {
  const r = rng(w)
  const hs = pl.hazards || []
  const roles = new Set(hs.flatMap((h) => HAZARDS[h.k].helpers).concat(['doctor']))
  // Where something is hunting people, only those who can fight it answer.
  const monsters = hs.some((h) => MONSTERS.has(h.k))
  const cands = alive(w).filter((p) => p.species === 'human' && !p.trip && isFree(p) && p.loc !== pl.id && !p.plan && w.places[p.loc].kind !== 'beyond'
    && (!monsters || (p.nen.awake && p.nen.lvl >= 45))
    && ((roles.has(p.role) && (p.facets.empathy > 45 || p.role === 'soldier')) || (p.license && p.facets.empathy > 72) || p.dreams.some((d) => d.k === 'doctor' || (d.k === 'protect' && d.target == null))))
  const near = cands.map((p) => ({ p, d: dist2(w.places[p.loc], pl) - (w.places[p.loc].nation === pl.nation ? 400 : 0) })).sort((a, b) => a.d - b.d)
  const n = Math.round(2 + sev * 8)
  let sent = 0
  for (const { p } of near) {
    if (sent >= n) break
    if (!r.chance(0.35 + p.facets.empathy / 250)) continue
    p.plan = { k: 'go', place: pl.id, until: w.t + 45, why: `Helping after the disaster in ${pl.name}`, ev }
    p.nextThink = w.t
    sent++
  }
}

function capital(s: string) { return s[0].toUpperCase() + s.slice(1) }

/** For a person: what is making the place they stand in dangerous, if anything. */
export function dangerAt(w: World, id: Id): { k: HazardKind; sev: number } | null {
  const pl = w.places[id]
  const top = (pl.hazards || []).reduce<Hazard | null>((m, h) => (!m || h.sev > m.sev ? h : m), null)
  return top ? { k: top.k, sev: top.sev } : null
}

export { change }
