/**
 * How people decide what to do, and what doing it does.
 *
 * Every so often (daily for the people the player is watching, every few
 * days for everyone else) a person scores their options: what their needs
 * are crying out for, the next step toward each dream, what their
 * organisation expects, what danger is near. Personality weighs every option
 * and a little noise keeps them human. The winner becomes their activity
 * until they next think.
 *
 * This is the level-of-detail trick Dwarf Fortress uses: the world keeps
 * running everywhere, but only the people near the camera are thinking every
 * day.
 */
import { NEEDS, type Need } from '../constants'
import { L, P, log } from '../history'
import type { ActKind, Id, Person, Place, World } from '../types'
import { at, rng, placeK, members } from '../world'
import { age, hpMax, isAdult, isFree, power, woundMods } from './person'
import { moodTick, remember } from './memory'
import { bondList, change, firstBonded, hasBond, interact, setBond, decayRelations } from './relations'
import { see } from './knowledge'
import { needsCare, nearestCare, careAt } from './health'
import { dreamOptions, type Option } from './dreams'
import { awaken, develop, nextTech, readyForHatsu, techMilestones, trainNen } from '../nen/nen'
import { contractsFor, earn, gamble, livingCost } from '../society/economy'
import { travel } from '../society/travel'
import { offerForge } from '../player/player'
import { romanceTick } from './romance'

/* ================= Needs ================= */

const DECAY: Record<Need, number> = {
  rest: 6, social: 3, family: 1.2, romance: 1.2, fight: 1.6, train: 2.2, learn: 1.6, wealth: 1.2, adventure: 1.5, purpose: 1.6, fame: 0.8, leisure: 2.2, justice: 0.9, solitude: 1.5,
}
/** What each activity gives back, per day. */
const SATISFY: Partial<Record<ActKind, Partial<Record<Need, number>>>> = {
  rest: { rest: 40, solitude: 8 }, recover: { rest: 35 }, train: { train: 14, fight: 3, rest: -4 }, meditate: { train: 8, solitude: 10, rest: 6 },
  work: { wealth: 10, purpose: 6, rest: -3 }, social: { social: 22, leisure: 4 }, leisure: { leisure: 20, social: 6, wealth: -2 },
  romance: { romance: 25, social: 10, leisure: 6 }, family: { family: 25, social: 8 }, study: { learn: 18 }, travel: { adventure: 6, rest: -2 },
  seek: { purpose: 5 }, investigate: { purpose: 6, learn: 4 }, guard: { purpose: 9 }, hunt: { purpose: 6, fight: 2 }, expedition: { adventure: 14, learn: 6, purpose: 6, fame: 2 },
  heal: { purpose: 10, justice: 4 }, teach: { purpose: 12, social: 8 }, crime: { wealth: 14, adventure: 4 }, mourn: { solitude: 8 },
  hide: { rest: 4 }, jail: {}, game: { adventure: 12, fight: 5, train: 6 }, duty: { purpose: 14, wealth: 3 }, wander: { adventure: 14, solitude: 6 },
  arena: { fight: 18, fame: 6, train: 4 }, scheme: { purpose: 6, leisure: 6 }, campaign: { purpose: 8, fame: 4, social: 6 }, swarm: { purpose: 12, fight: 6 }, feed: { purpose: 8 },
}

export function needsTick(w: World, p: Person, days = 1) {
  const sat = SATISFY[p.act.k] || {}
  let stress = 0
  for (const n of NEEDS) {
    p.needs[n] = Math.max(0, Math.min(100, p.needs[n] - DECAY[n] * days + (sat[n] || 0) * days))
    stress += (100 - p.needs[n]) * p.needW[n]
  }
  // Unmet needs that matter to someone become stress; met ones relieve it.
  const target = Math.min(100, stress / 25)
  p.mood.stress += (target - p.mood.stress) * Math.min(1, 0.05 * days)
  moodTick(w, p, days)
}

/* ================= Thinking ================= */

function opt(k: ActKind, u: number, why: string, o: Partial<Option> = {}): Option {
  return { k, u, why, ...o }
}

function deficit(p: Person, n: Need): number {
  return (100 - p.needs[n]) / 100 * p.needW[n]
}

export function think(w: World, p: Person, focus: boolean) {
  const r = rng(w)
  const f = p.facets
  const place = w.places[p.loc]
  const here = at(w, p.loc).filter((q) => q !== p)
  const hp = p.hp / hpMax(p)
  const wm = woundMods(p)
  const opts: Option[] = []

  // Hurt: get treated, then rest.
  const care = needsCare(p)
  if (care >= 1) {
    const c = careAt(w, p)
    if (!c || c.lvl < care) {
      const dest = nearestCare(w, p, care)
      if (dest != null && dest !== p.loc) opts.push(opt('travel', 6 + care, 'Looking for a doctor', { place: dest }))
    }
  }
  opts.push(opt('rest', deficit(p, 'rest') * 2 + (1 - hp) * 4 + (p.stam < 40 ? 1 : 0) + (wm.worst >= 2 ? 1.5 : 0), hp < 0.6 ? 'Recovering from injuries' : 'Resting', { days: hp < 0.5 ? 3 : 1 }))
  if (p.mood.grief > 45) opts.push(opt('mourn', p.mood.grief / 40, 'Grieving', { days: 3 }))

  // Training: everyone who wants to grow, more with a teacher nearby.
  const mentor = mentorHere(w, p)
  const trainU = deficit(p, 'train') * 1.6 + f.ambition / 160 + (mentor ? 0.6 : 0) + (p.nen.awake ? 0 : 0.2) + (age(w, p) < 25 ? 0.2 : 0)
  if (hp > 0.5) opts.push(opt('train', trainU, mentor ? `Training under ${mentor.name}` : p.nen.awake ? 'Training Nen' : 'Training body and focus', { days: 3 + r.int(3), with: mentor?.id }))

  // Company, family, love.
  // The three people here they like best (one of them, at random), without
  // sorting the whole room.
  let b1: Person | null = null, b2: Person | null = null, b3: Person | null = null, a1 = -1e9, a2 = -1e9, a3 = -1e9
  for (const q of here) {
    const a = p.rel[q.id]?.aff ?? 0
    if (a <= -15 || a <= a3 || !isFree(q)) continue
    if (a > a1) { b3 = b2; a3 = a2; b2 = b1; a2 = a1; b1 = q; a1 = a }
    else if (a > a2) { b3 = b2; a3 = a2; b2 = q; a2 = a }
    else { b3 = q; a3 = a }
  }
  if (b1) {
    const top = [b1, b2, b3].filter((x): x is Person => !!x)
    const best = top[r.int(top.length)]
    opts.push(opt('social', deficit(p, 'social') * 1.7 + f.sociability / 220, `Spending time with ${best.name}`, { with: best.id, days: 1 + r.int(2) }))
    const near = (q: Person) => q.loc === p.loc && !q.trip && isFree(q) && (p.rel[q.id]?.aff ?? 0) > -15
    const kin = firstBonded(w, p, 'parent', near) || firstBonded(w, p, 'child', near) || firstBonded(w, p, 'sibling', near) || firstBonded(w, p, 'spouse', near)
    if (kin) opts.push(opt('family', deficit(p, 'family') * 1.8, `With family: ${kin.name}`, { with: kin.id, days: 2 }))
    const love = isAdult(w, p) && w.laws.romance ? firstBonded(w, p, 'lover', near) || firstBonded(w, p, 'spouse', near) || firstBonded(w, p, 'crush', near) : null
    if (love) opts.push(opt('romance', deficit(p, 'romance') * 2 + 0.2, `Time with ${love.name}`, { with: love.id, days: 1 }))
  }
  if (deficit(p, 'solitude') > 0.6) opts.push(opt('rest', deficit(p, 'solitude') * 1.2, 'Keeping to themselves', { days: 2 }))

  // Work and money.
  const pays = p.role !== 'child' && p.role !== 'student' && p.role !== 'prince'
  // Being broke drives adults to work; a child or a Hunter living off the
  // licence gets by.
  const broke = p.jenny < 1 ? (age(w, p) >= 16 && !p.license ? 1.5 : 0.4) : 0
  if (pays) opts.push(opt('work', deficit(p, 'wealth') * 1.4 + deficit(p, 'purpose') * 0.7 + broke, workNote(w, p), { days: 3 + r.int(3) }))
  if (place.features.includes('casino') || place.features.includes('market')) opts.push(opt('leisure', deficit(p, 'leisure') * 1.4 + f.whimsy / 400, place.features.includes('casino') ? 'At the tables' : 'Out in the city', { days: 1 }))
  if (place.features.includes('library')) opts.push(opt('study', deficit(p, 'learn') * 1.5, 'Reading in the library', { days: 3, focus: 'scholarship' }))

  // Some people do not wander: royals, rulers, bosses, butlers, children, prisoners of their family.
  const homebound = /prince|royal|ruler|don|politician|butler|child/.test(p.role) || age(w, p) < 13 || !!p.flags.confined || !!p.flags.homebound || age(w, p) > 85
  const roam = homebound ? 0.1 : 1
  // Fighting for its own sake.
  if (p.nen.awake && deficit(p, 'fight') > 0.4 && !homebound) {
    if (place.key === 'arena') opts.push(opt('arena', deficit(p, 'fight') * 2 + 0.3, 'Fighting in Heavens Arena', { days: 3 }))
    else if (p.role === 'fighter' || f.aggression > 65) opts.push(opt('travel', deficit(p, 'fight') * 0.5, 'Heading for Heavens Arena', { place: placeK(w, 'arena').id }))
  }

  // A place that is killing people: anyone who is not there on purpose leaves.
  if (place.hazard > 0.3 && p.species !== 'ant' && !(p.plan && p.plan.k !== 'exam' && (p.plan.place === p.loc || p.plan.k === 'hunt'))) {
    const safe = nearby(w, p.loc).find((x) => x.hazard < 0.2 && !x.hidden)
    if (safe) opts.push(opt('travel', 2.5 + place.hazard * 4 + f.bravery / -60 + (p.mood.fear / 30), `Getting out of ${place.name}`, { place: safe.id }))
  }

  // Seeing the world: somewhere not too far, most of the time.
  if (deficit(p, 'adventure') > 0.3 && !p.flags.confined) {
    const cand = nearby(w, p.loc).filter((x) => (!x.hidden || p.home === x.id) && x.hazard < 0.3)
    const dest = cand[Math.min(cand.length - 1, Math.floor(r.next() * r.next() * cand.length))]
    if (dest) opts.push(opt('travel', (deficit(p, 'adventure') * 1.1 + f.curiosity / 400) * roam, `Travelling to ${dest.name}`, { place: dest.id }))
  }

  // Profession.
  if (/^(gourmet|beast|ruins|treasure|sea|virus)$/.test(p.role) && (place.features.includes('wild') || place.features.includes('ruins'))) {
    opts.push(opt('expedition', 0.8 + deficit(p, 'purpose'), `Working in the field near ${place.name}`, { days: 6, focus: p.role }))
  }
  if (p.role === 'doctor' && place.hospital >= 1) opts.push(opt('heal', 1 + f.empathy / 200, `Treating patients in ${place.name}`, { days: 4 }))
  if (p.role === 'master' || p.role === 'chairman') {
    const st = here.filter((q) => hasBond(p.rel[q.id], 'student'))
    if (st.length) opts.push(opt('teach', 1.2 + f.empathy / 300, `Teaching ${st[0].name}`, { with: st[0].id, days: 3 }))
  }
  if (p.role === 'thief' || p.role === 'criminal') opts.push(opt('crime', 0.5 + deficit(p, 'wealth'), 'Stealing', { days: 3 }))
  if (p.role === 'fighter' && place.key === 'arena') opts.push(opt('arena', 1 + deficit(p, 'fight'), 'Fighting in Heavens Arena', { days: 3 }))

  // Duties to an organisation, and open contracts.
  for (const m of p.orgs) {
    const org = w.orgs[m.org]
    if (org.kind === 'bloc') continue
    opts.push(opt('duty', deficit(p, 'purpose') * 1.1 + m.loyalty / 250, `Working for the ${org.name}`, { days: 3 + r.int(3) }))
    if (org.kind !== 'swarm' && p.loc !== org.hq && m.loyalty > 60 && r.chance(0.08)) opts.push(opt('travel', 0.5, `Returning to the ${org.name}`, { place: org.hq }))
  }
  if (p.jenny < 20 && (p.nen.lvl > 35 || p.license)) {
    const cs = contractsFor(w, p).filter((c) => c.k === 'bodyguard' || (c.k === 'bounty' && c.target != null && power(w.people[c.target]) < power(p) * 0.8))
    if (cs.length) {
      const c = cs[0]
      opts.push(opt('duty', 0.9 + c.reward / 200, `Considering a job: ${c.why || c.k}`, { days: 1, run: () => {
        Dreams.takeContractPublic(w, p, c.id)
      } }))
    }
  }

  // Dreams.
  for (const o of dreamOptions(w, p)) opts.push(o)

  // An order or a hunt already in progress keeps its weight.
  if (p.plan && w.t <= p.plan.until) {
    const t = p.plan.target != null ? w.people[p.plan.target] : null
    if (p.plan.k === 'hunt' && t && t.alive) {
      if (t.loc !== p.loc || t.trip) {
        const wi = p.seen[t.id]
        if (wi && w.t - wi[1] < 40 && wi[0] !== p.loc) opts.push(opt('travel', 2.4, `Going after ${t.name}`, { place: wi[0] }))
        else opts.push(opt('investigate', 1.4, `Tracking ${t.name}`, { with: t.id, days: 2 }))
      } else opts.push(opt('hunt', 3, `Closing in on ${t.name}`, { days: 1 }))
    } else if (p.plan.k === 'go' && p.plan.place != null && p.plan.place !== p.loc) {
      opts.push(opt('travel', 3, p.plan.why || 'On their way', { place: p.plan.place }))
    } else if (p.plan.k === 'exam') {
      opts.push(opt('train', 2, 'Waiting for the Exam to begin', { days: 1 }))
    }
  } else if (p.plan && w.t > p.plan.until) p.plan = null

  // A whisper from the player tilts the next choice, if the person already leans that way at all.
  const whisper = p.flags.whisper as string | undefined
  if (whisper) delete p.flags.whisper
  // Choose.
  let best: Option | null = null, bs = -1e9
  for (const o of opts) {
    if (o.k === 'travel' && (p.flags.confined || p.flags.castaway || p.flags.onExp != null && place.kind === 'beyond')) continue
    let s = o.u * (0.8 + r.next() * 0.4)
    if (whisper && o.k === whisper) s *= 1.8
    if (s > bs) { bs = s; best = o }
  }
  if (!best) best = opt('rest', 0, 'Resting')
  apply(w, p, best, focus)
}

/** Ordinary places by distance from one place, nearest first. Static, so
 *  worked out once per world. */
const NEAR = new WeakMap<World, Map<Id, Place[]>>()
function nearby(w: World, from: Id): Place[] {
  let m = NEAR.get(w)
  if (!m) NEAR.set(w, (m = new Map()))
  let l = m.get(from)
  if (!l) {
    const o = w.places[from]
    l = w.places.filter((x) => x.id !== from && x.kind !== 'beyond' && x.kind !== 'ship' && !x.features.includes('game'))
      .sort((a, b) => ((a.x - o.x) ** 2 + (a.y - o.y) ** 2) - ((b.x - o.x) ** 2 + (b.y - o.y) ** 2))
    m.set(from, l)
  }
  return l
}

function apply(w: World, p: Person, o: Option, focus: boolean) {
  if (o.plan !== undefined) p.plan = o.plan
  if (o.run) o.run()
  if (o.k === 'travel' && o.place != null) {
    if (travel(w, p, o.place)) {
      p.act = { k: 'travel', until: p.trip!.t1, note: o.why }
      p.nextThink = p.trip!.t1
      return
    }
    p.act = { k: 'rest', until: w.t + 1, note: 'Resting' }
    p.nextThink = w.t + 1
    return
  }
  let days = Math.max(1, Math.min(o.days ?? 2, focus ? 2 : 7))
  // Away from the focus, minor people commit to things a little longer.
  if (!focus && !p.major && !p.owned && o.k !== 'hunt' && o.k !== 'investigate') days = Math.max(days, 2 + (p.id & 1))
  p.act = { k: o.k, with: o.with, until: w.t + days, note: o.why, focus: o.focus }
  p.nextThink = w.t + days
}

/* ================= Doing ================= */

export function mentorHere(w: World, p: Person): Person | null {
  return firstBonded(w, p, 'mentor', (q) => q.loc === p.loc && !q.trip && isFree(q))
}

/** One day of whatever someone is doing. */
export function doDay(w: World, p: Person, focus: boolean) {
  const r = rng(w)
  const place = w.places[p.loc]
  p.jenny -= livingCost(p)
  switch (p.act.k) {
    case 'train': case 'meditate': {
      const m = mentorHere(w, p)
      const intensity = p.act.focus === 'hard' ? 1.25 : 1
      p.stam = Math.max(0, p.stam - 25 * intensity)
      if (!p.nen.awake) {
        // The slow road needs a teacher; the body grows either way.
        bodyTrain(w, p, intensity)
        if (m && m.nen.awake && p.species === 'human') {
          p.flags.medDays = ((p.flags.medDays as number) || 0) + 1
          const impatient = m.facets.impulsivity > 70 || m.facets.cruelty > 60 || (p.flags.medDays as number) > 6 && m.facets.empathy < 40
          if (impatient && r.chance(0.08)) awaken(w, p, 'forced', m)
          else if ((p.flags.medDays as number) >= 14 + Math.round(40 / Math.max(0.3, p.nen.pot))) awaken(w, p, 'slow', m)
        } else if (p.nen.pot > 1.4 && r.chance(0.0008)) awaken(w, p, 'innate')
        break
      }
      const before = { ...p.nen.tech }
      const t = p.act.focus && p.act.focus !== 'hard' ? p.act.focus : (r.chance(0.6) ? nextTech(p) : null) || (r.chance(0.5) ? String(p.nen.type) : 'base')
      trainNen(w, p, t, m || undefined, intensity)
      if (r.chance(0.35)) bodyTrain(w, p, intensity * 0.5)
      techMilestones(w, p, before, m || undefined)
      if (readyForHatsu(p) && r.chance(p.nen.hatsu.length && !p.flags.fixedHatsu ? 0.0012 : 0.06)) {
        if (p.owned) offerForge(w, p)
        else develop(w, p)
      }
      break
    }
    case 'work': case 'duty': earn(w, p); p.skills.negotiation = Math.min(100, p.skills.negotiation + 0.02); break
    case 'heal': earn(w, p); p.skills.medicine = Math.min(100, p.skills.medicine + 0.05); break
    case 'study': {
      const s = (p.act.focus === 'medicine' ? 'medicine' : 'scholarship') as 'medicine' | 'scholarship'
      p.skills[s] = Math.min(100, p.skills[s] + 0.25 * (0.5 + p.mind.int / 100))
      break
    }
    case 'social': case 'family': case 'romance': {
      const q = p.act.with != null ? w.people[p.act.with] : null
      if (q && q.alive && q.loc === p.loc && !q.trip) interact(w, p, q, focus)
      break
    }
    case 'leisure': if (place.features.includes('casino')) gamble(w, p); break
    case 'investigate': break
    case 'expedition': expeditionDay(w, p); break
    case 'crime': crimeDay(w, p); break
    case 'teach': {
      const q = p.act.with != null ? w.people[p.act.with] : null
      if (q && q.loc === p.loc) change(w, q, p, { resp: 0.5, aff: 0.4, fam: 0.5 })
      break
    }
    case 'mourn': p.mood.grief = Math.max(0, p.mood.grief - 1.5); break
    case 'game': gameDay(w, p); break
    case 'wander': p.skills.survival = Math.min(100, p.skills.survival + 0.05); break
  }
  if (p.act.k === 'investigate' && p.act.with != null) {
    const t = w.people[p.act.with]
    if (t && t.alive) {
      Know.investigate(w, p, t)
    }
  }
}

function bodyTrain(w: World, p: Person, k: number) {
  const r = rng(w)
  const young = age(w, p) < 30 ? 1 : 0.4
  const g = 0.04 * k * young * (0.5 + r.next())
  const a = r.pick(['str', 'agi', 'tou', 'endu', 'refl'] as const)
  if (p.attrs[a] < 99) p.attrs[a] = Math.min(99, p.attrs[a] + g * 3)
  p.skills.unarmed = Math.min(100, p.skills.unarmed + 0.08 * k)
  if (!p.nen.awake) p.nen.lvl = Math.min(p.nen.cap * 0.3, p.nen.lvl + 0.01 * p.nen.pot)
}

function workNote(w: World, p: Person): string {
  const place = w.places[p.loc]
  switch (p.role) {
    case 'blacklist': return 'Working a case for the Association'
    case 'assassin': return 'On a quiet job'
    case 'butler': return 'Serving the family'
    case 'mafioso': case 'don': return 'Running family business'
    case 'soldier': case 'officer': return 'On duty'
    case 'doctor': return `Treating patients in ${place.name}`
    case 'merchant': return 'Making deals'
    case 'fighter': return 'Fighting for prize money'
    default: return `Working in ${place.name}`
  }
}

function expeditionDay(w: World, p: Person) {
  const r = rng(w)
  const place = w.places[p.loc]
  p.stam = Math.max(0, p.stam - 15)
  p.skills.survival = Math.min(100, p.skills.survival + 0.08)
  if (r.chance(0.035 * place.danger)) {
    const wd = Health.addWound(w, p, 0.15 + r.next() * 0.3)
    p.hp = Math.max(1, p.hp - hpMax(p) * 0.25)
    if (wd && (p.major || p.owned)) log(w, { type: 'misc', imp: 1, who: [p.id], at: p.loc, text: `${P(p)} is hurt in the wilds near ${L(place)}.` })
    if (r.chance(0.04 * place.danger * (w.laws.lethality / 0.5)) && power(p) < 40) {
      Death.kill(w, p, { cause: `lost in the wilds near ${place.name}`, how: `${P(p)} goes into the wilds near ${L(place)} and does not come back.` })
      return
    }
  }
  if (r.chance(0.003 + p.skills.survival / 20000 + p.mind.int / 25000)) {
    const field = p.act.focus || p.role
    const what = field === 'gourmet' ? 'an ingredient nobody has ever cooked' : field === 'ruins' || field === 'treasure' ? 'a cache older than any nation still standing' : field === 'sea' ? 'a creature nobody has ever named' : field === 'virus' ? 'the cure for a disease thought incurable' : 'an animal nobody has ever recorded'
    p.fame += 6
    p.jenny += 15 + r.int(40)
    for (const d of p.dreams) if (d.k === 'discover') d.prog = Math.min(100, d.prog + 25)
    log(w, { type: 'discovery', imp: p.major || p.owned ? 3 : 2, who: [p.id], at: p.loc, text: `${P(p)} discovers ${what} near ${L(place)}.` })
    remember(w, p, { k: 'discovery', val: 50, str: 55, text: `Discovered ${what}.` })
  }
}

function crimeDay(w: World, p: Person) {
  const r = rng(w)
  if (r.chance(0.2)) {
    const take = (0.05 + r.next() * 0.4) * (w.places[p.loc].wealth + 0.2) * (1 + p.skills.stealth / 100)
    p.jenny += take
    p.infamy += 0.05
    if (r.chance(0.05 - p.skills.stealth / 4000)) {
      p.infamy += 3
      if (p.major || p.owned) log(w, { type: 'crime', imp: 1, who: [p.id], at: p.loc, text: `${P(p)} is seen robbing someone in ${L(w.places[p.loc])}.` })
    }
  }
}

function gameDay(w: World, p: Person) {
  const r = rng(w)
  const d = p.dreams.find((x) => x.k === 'clear' && !x.done)
  // A hundred designated-slot cards. The first seventy come to anyone
  // patient; the last thirty need luck, spells, trades, and a team that can
  // hold what it has. Most players never get there.
  const team = p.party != null ? w.parties.find((x) => x.id === p.party)?.members.filter((id) => w.people[id]?.alive && w.people[id].loc === p.loc).length ?? 1 : 1
  const prog = d?.prog ?? 0
  const late = prog > 90 ? (team >= 3 ? 0.25 : 0.06) : prog > 70 ? 0.4 : 1
  const gain = (0.07 + p.mind.int / 500 + p.nen.lvl / 500) * Math.min(2, 1 + 0.3 * (team - 1)) * late * (0.5 + r.next())
  if (d) d.prog = Math.min(100, d.prog + gain)
  p.nen.lvl = Math.min(p.nen.cap, p.nen.lvl + 0.02)
  if (d && d.prog >= 100) {
    GI.clearGame(w, p)
  }
}

/* ================= Social day per place ================= */

/** Everyone in the same place sees each other; some talk; teachers find
 *  students; people fall for each other. */
export function placeDay(w: World, place: Id) {
  const r = rng(w)
  const here = at(w, place)
  if (here.length < 2) return
  // Notice: who is here, for people one cares about. Sightings only need to
  // be roughly fresh, so a crowded place is surveyed every third day.
  if ((w.t + place) % 3 === 0) {
    for (const p of here) {
      for (const q of here) {
        if (p !== q && (p.rel[q.id] || q.fame > 30 || p.plan?.target === q.id)) see(w, p, q)
      }
    }
  }
  // Chance meetings between strangers.
  const meet = Math.min(4, Math.floor(here.length / 3) + 1)
  for (let i = 0; i < meet; i++) {
    const a = r.pick(here), b = r.pick(here)
    if (a === b || !isFree(a) || !isFree(b)) continue
    if (r.chance(0.15 + a.facets.sociability / 300)) interact(w, a, b, false)
  }
  // Students find teachers: someone who wants to grow meets someone who
  // can, and is willing to, teach them.
  for (const p of here) {
    if (!wantsTeacher(w, p)) continue
    const teachers = here.filter((q) => canTeach(w, q, p))
    if (!teachers.length) continue
    const t = teachers.sort((a, b) => (b.role === 'master' ? 30 : 0) + b.nen.lvl + (p.rel[b.id]?.aff ?? 0) / 2 - (a.role === 'master' ? 30 : 0) - a.nen.lvl - (p.rel[a.id]?.aff ?? 0) / 2)[0]
    const willing = t.role === 'master' ? 0.12 : 0.01 + Math.max(0, (t.rel[p.id]?.aff ?? 0)) / 2500 + p.nen.pot / 120
    if (r.chance(willing)) {
      setBond(w, p, t, 'mentor')
      change(w, p, t, { aff: 15, resp: 20, trust: 15, fam: 10 })
      change(w, t, p, { aff: 10, fam: 10 })
      log(w, { type: 'bond', imp: p.major || t.major || p.owned ? 2 : 1, who: [p.id, t.id], at: place, text: `${P(t)} agrees to teach ${P(p)} in ${L(w.places[place])}.` })
      remember(w, p, { k: 'mentor', who: t.id, val: 40, str: 50, text: `${t.name} agreed to teach me.` })
    }
  }
  romanceTick(w, here)
}

/* Hooks resolved lazily to keep the import graph acyclic at load time. */
import * as Dreams from './dreams'
import * as Know from './knowledge'
import * as Health from './health'
import * as Death from '../events/death'
import * as GI from '../society/greed'

function wantsTeacher(w: World, p: Person): boolean {
  if (p.species !== 'human' || p.nen.lvl >= 38 || p.conds.length) return false
  const a = age(w, p)
  if (a < 10 || a > 35) return false
  // A teacher on the other side of the world teaches nothing.
  for (const q of at(w, p.loc)) if (q !== p && hasBond(p.rel[q.id], 'mentor')) return false
  if (/prince|royal|ruler|don|politician/.test(p.role)) return false
  return p.dreams.some((d) => !d.done && !d.failed && ['strongest', 'hunter', 'avenge', 'defeat', 'master', 'clear'].includes(d.k)) || p.needW.train > 1.3
}

function canTeach(w: World, q: Person, p: Person): boolean {
  if (q === p || !q.nen.awake || q.nen.lvl < Math.max(50, p.nen.lvl + 20) || !q.alive || q.conds.length) return false
  if (age(w, q) < 22) return false
  if (q.orgs.some((m) => ['troupe', 'ants', 'bombers'].includes(w.orgs[m.org].key))) return false
  if ((q.rel[p.id]?.aff ?? 0) < -10) return false
  let students = 0
  for (const id of bondList(q)) if (hasBond(q.rel[id], 'student')) students++
  if (students >= 3) return false
  return q.role === 'master' || q.facets.empathy > 55 || (q.rel[p.id]?.aff ?? 0) > 30
}

export function relationsWeekly(w: World, p: Person) {
  // Forgetting is slow; it is done in four-week steps, a quarter of the
  // people each week.
  if ((Math.floor(w.t / 7) + p.id) % 4 === 0) decayRelations(w, p, 28)
}

export { members }
