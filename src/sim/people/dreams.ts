/**
 * Dreams: what people want from their lives, and the next concrete step
 * toward it.
 *
 * Each kind of dream offers options to the decision-maker (decide.ts) with a
 * utility, competing with needs and duties. The steps are drawn from what the
 * characters actually did: Gon took the Hunter Exam because a licence is how
 * you find a Hunter; Kurapika took a job guarding a Mafia boss's daughter
 * because it put him in the room with the Scarlet Eyes; Leorio needed a
 * licence because it waives medical school fees.
 */
import { L, O, P, log } from '../history'
import type { Dream, DreamKind, Id, Intent, Person, World } from '../types'
import type { ActKind } from '../types'
import { alive, at, members, orgK, personK, placeK, rng, touch } from '../world'
import { age, hpMax, isAdult, power, inOrg } from './person'
import { factById, investigate, knownKiller, whereIs, addFact, learn } from './knowledge'
import { remember } from './memory'
import { change, firstBonded, hasBond, isKin, setBond } from './relations'
import { swearAllIn, swearVow } from '../nen/vows'
import { contractsFor } from '../society/economy'
import { route, travel } from '../society/travel'
import { offerCrossroad } from '../player/player'
import { startStory } from '../story/storyteller'

export interface Option {
  k: ActKind
  u: number
  why: string
  days?: number
  with?: Id
  place?: Id
  focus?: string
  plan?: Intent | null
  run?: () => void
  dream?: number
}

const go = (w: World, p: Person, place: Id, u: number, why: string, dream?: number): Option | null => {
  if (place === p.loc) return null
  const rt = route(w, p, place)
  if (!rt.ok) return null
  return { k: 'travel', u, why, place, dream }
}

/** Distance in days, for judging whether there is time to get somewhere. */
function daysTo(w: World, p: Person, place: Id): number {
  if (place === p.loc) return 0
  const rt = route(w, p, place)
  return rt.ok ? rt.days : 999
}

export function dreamOptions(w: World, p: Person): Option[] {
  const out: Option[] = []
  p.dreams.forEach((d, i) => {
    if (d.done || d.failed) return
    const h = HANDLERS[d.k]
    if (!h) return
    for (const o of h(w, p, d, i)) if (o) out.push({ ...o, dream: i })
  })
  return out
}

type Handler = (w: World, p: Person, d: Dream, i: number) => (Option | null)[]

const pri = (d: Dream) => d.pri / 100

const HANDLERS: Partial<Record<DreamKind, Handler>> = {
  /* ---------- Become a Hunter ---------- */
  hunter(w, p, d) {
    if (p.license) { d.done = w.t; return [] }
    const ex = w.flags.exam as { place: Id; start: number; n: number } | undefined
    if (ex && w.t < ex.start) {
      const need = daysTo(w, p, ex.place)
      const left = ex.start - w.t
      if (p.loc === ex.place) return [{ k: 'train', u: 2.5 * pri(d), why: `Waiting for Hunter Exam ${ex.n} to start`, days: Math.min(left, 2), plan: { k: 'exam', until: ex.start + 20, why: 'to take the Hunter Exam' } }]
      if (need <= left + 1 && left < 40) return [go(w, p, ex.place, 3 * pri(d), `Heading to Hunter Exam ${ex.n}`)]
    }
    // Between exams: get stronger.
    return [{ k: 'train', u: 0.6 * pri(d), why: 'Getting ready for the Hunter Exam', days: 4 }]
  },

  /* ---------- Find someone ---------- */
  find(w, p, d) {
    if (d.target == null) return []
    const t = w.people[d.target]
    if (!t || !t.alive) { d.failed = w.t; return [] }
    if (t.loc === p.loc && !t.trip && !p.trip) {
      return [{ k: 'social', u: 4 * pri(d), why: `Finally face to face with ${t.name}`, with: t.id, days: 2, run: () => (slipsAway(w, p, t) ? void 0 : found(w, p, t, d)) }]
    }
    const wi = whereIs(w, p, t)
    if (wi && wi.age < 40) return [go(w, p, wi.place, 2.6 * pri(d), `Going after ${t.name}, last seen in ${w.places[wi.place].name}`)]
    // Not knowing where: a licence opens the Hunter website and every door.
    if (!p.license && p.dreams.some((x) => x.k === 'hunter' && !x.done)) {
      const hd = p.dreams.find((x) => x.k === 'hunter')!
      hd.pri = Math.max(hd.pri, d.pri)
      return [{ k: 'train', u: 0.8 * pri(d), why: `Training. A Hunter licence is how you find a Hunter`, days: 3 }]
    }
    return [{ k: 'investigate', u: 1.3 * pri(d), why: `Searching for ${t.name}`, with: t.id, days: 3, run: () => searchFor(w, p, t, d) }]
  },

  /* ---------- Revenge ---------- */
  avenge(w, p, d) {
    const r = rng(w)
    let target: Person | null = null
    if (d.tag === 'org') {
      const org = w.orgs[d.target!]
      if (!org || org.dead || !members(w, org.id).length) { d.done = w.t; vowDone(w, p, d); return [] }
      // Which Spiders does he know by sight?
      const known = members(w, org.id).filter((m) => p.know[-500000 - m.id] != null || m.infamy > 40 || p.seen[m.id])
      const pool = known.length ? known : []
      if (!pool.length) return [{ k: 'investigate', u: 1.2 * pri(d), why: `Hunting for any trace of the ${org.name}`, days: 4, run: () => { for (const m of members(w, org.id)) if (r.chance(0.08)) investigate(w, p, m) } }]
      pool.sort((a, b) => (whereIs(w, p, a)?.age ?? 999) - (whereIs(w, p, b)?.age ?? 999))
      target = pool[0]
    } else if (d.target != null && d.target >= 0) {
      target = w.people[d.target]
    } else {
      // The killer is unknown. Find out who it was.
      const dead = d.tag ? w.people[+d.tag] : null
      if (!dead) { d.failed = w.t; return [] }
      return [{ k: 'investigate', u: 1.1 * pri(d), why: `Trying to learn who killed ${dead.name}`, days: 4, run: () => {
        if (r.chance(0.04 + (p.skills.tracking + p.mind.int) / 2500 + (p.license ? 0.04 : 0))) {
          const f = w.facts.find((f) => f.k === 'crime' && f.o === dead.id && f.d === 'kill')
          if (f) {
            learn(w, p, f)
            const k = w.people[f.s]
            d.target = k.id
            d.tag = undefined
            log(w, { type: 'misc', imp: p.major || p.owned ? 3 : 1, who: [p.id, k.id, dead.id], at: p.loc, text: `${P(p)} learns who killed ${P(dead)}: ${P(k)}.` })
          }
        }
      } }]
    }
    if (!target || !target.alive) return []
    const mine = power(p) * vowMultPreview(p, target)
    const theirs = power(target)
    const ready = mine >= theirs * (0.85 - p.facets.impulsivity / 400) || p.mood.anger > 85
    if (!ready) {
      return [{ k: 'train', u: 1.9 * pri(d), why: `Training to be strong enough to kill ${target.name}`, days: 5, focus: 'hard' }]
    }
    if (target.loc === p.loc && !target.trip) {
      return [{ k: 'hunt', u: 3.5 * pri(d), why: `Closing in on ${target.name}`, days: 1, plan: { k: 'hunt', target: target.id, until: w.t + 30, why: 'for revenge', data: { intent: d.tag === 'org' && p.nen.hatsu.some((h) => h.effects.some((e) => e.k === 'bind')) ? 'capture' : 'kill' } } }]
    }
    const wi = whereIs(w, p, target)
    if (wi && wi.age < 45) return [go(w, p, wi.place, 2.4 * pri(d), `Going after ${target.name}`)]
    return [{ k: 'investigate', u: 1.3 * pri(d), why: `Hunting for ${target.name}`, with: target.id, days: 3, run: () => { investigate(w, p, target!) } }]
  },

  /* ---------- Get items back (the Scarlet Eyes) ---------- */
  recover(w, p, d) {
    const r = rng(w)
    const kind = d.tag || ''
    const all = w.items.filter((it) => it.k === kind)
    if (!all.length) return []
    const mine = all.filter((it) => it.holder === p.id).length
    d.prog = Math.round(mine / all.length * 100)
    if (mine === all.length) { d.done = w.t; return [] }
    // Known holders: people p knows hold one.
    const known = all.filter((it) => it.holder >= 0 && it.holder !== p.id && w.people[it.holder]?.alive && (p.know[holderFactKey(w, it.id)] != null || w.people[it.holder].fame > 50 && r.chance(0.3)))
    if (known.length) {
      const it = known[0]
      const h = w.people[it.holder]
      if (h.loc === p.loc && !h.trip) {
        return [{ k: 'scheme', u: 2.2 * pri(d), why: `Trying to get the ${it.name} from ${h.name}`, with: h.id, days: 2, run: () => acquire(w, p, it.id, h) }]
      }
      return [go(w, p, h.loc, 1.6 * pri(d), `Following the trail of the ${it.name} to ${h.name}`)]
    }
    return [{ k: 'investigate', u: 0.9 * pri(d), why: `Asking around for the ${kind === 'scarlet_eyes' ? 'Scarlet Eyes' : kind}`, days: 4, run: () => {
      const cand = all.filter((it) => it.holder >= 0 && it.holder !== p.id)
      if (cand.length && r.chance(0.05 + (p.license ? 0.04 : 0) + Math.min(0.06, p.jenny / 1000))) {
        const it = r.pick(cand)
        const f = addFact(w, { k: 'item', s: it.holder, o: it.id, secret: 0.5, imp: 2, text: `${w.people[it.holder].name} has the ${it.name}.` })
        learn(w, p, f)
        p.know[holderFactKey(w, it.id)] = w.t
      }
    } }]
  },

  /* ---------- Get stronger ---------- */
  strongest(w, p, d) {
    const opts: Option[] = [{ k: 'train', u: 1.1 * pri(d) * (1 + p.facets.ambition / 200), why: 'Training to get stronger', days: 4, focus: 'hard' }]
    if (p.nen.awake && p.facets.aggression > 55) opts.push({ k: 'arena', u: 0.8 * pri(d) * (p.loc === placeK(w, 'arena').id ? 1.4 : 0.6), why: 'Looking for strong opponents in Heavens Arena', days: 5 })
    return opts
  },

  /* ---------- Beat one person ---------- */
  defeat(w, p, d) {
    const t = d.target != null ? w.people[d.target] : null
    if (!t || !t.alive) { d.failed = w.t; return [] }
    // The proud want the fight at its best: both at full strength, nobody else involved.
    const margin = p.facets.pride > 70 ? 1.02 : 0.9 - p.facets.impulsivity / 500
    const ready = power(p) >= power(t) * margin && w.t >= ((p.flags[`rematch:${t.id}`] as number) || 0)
    if (!ready) return [{ k: 'train', u: 1.3 * pri(d), why: `Training for the day they face ${t.name}`, days: 5 }]
    const alone = at(w, t.loc).filter((q) => q !== t && (q.rel[t.id]?.aff ?? 0) > 40 && q !== p).length === 0
    if (t.loc === p.loc && !t.trip && (alone || p.facets.pride < 60)) return [{ k: 'hunt', u: 3 * pri(d), why: `Challenging ${t.name}`, days: 1, plan: { k: 'hunt', target: t.id, until: w.t + 20, why: 'to settle things', data: { intent: 'duel', dream: 'defeat' } } }]
    if (t.loc === p.loc) return [{ k: 'wander', u: 0.8 * pri(d), why: `Waiting for ${t.name} to be alone`, days: 3 }]
    const wi = whereIs(w, p, t)
    if (wi && wi.age < 60) return [go(w, p, wi.place, 1.8 * pri(d), `Going to find ${t.name}`)]
    return [{ k: 'investigate', u: 0.8 * pri(d), why: `Looking for ${t.name}`, with: t.id, days: 3, run: () => { investigate(w, p, t) } }]
  },

  /* ---------- Become a doctor ---------- */
  doctor(w, p, d) {
    if (p.role === 'doctor') { d.done = w.t; return [] }
    if (p.skills.medicine >= 60 && (p.license || p.jenny > 60)) {
      return [{ k: 'study', u: 2 * pri(d), why: 'Qualifying as a doctor', days: 5, run: () => {
        p.role = 'doctor'
        d.done = w.t
        if (!p.license) p.jenny -= 60
        const ev = log(w, { type: 'job', imp: p.major || p.owned ? 3 : 1, who: [p.id], at: p.loc, text: `${P(p)} qualifies as a doctor${p.license ? '. The Hunter licence paid the fees' : ''}.` })
        remember(w, p, { k: 'doctor', val: 60, str: 70, ev, text: 'Became a doctor.' })
      } }]
    }
    const lib = w.places[p.loc].features.includes('library') || w.places[p.loc].hospital >= 2
    if (lib) return [{ k: 'study', u: 1.2 * pri(d), why: 'Studying medicine', days: 5, focus: 'medicine' }]
    const school = w.places.filter((x) => x.hospital >= 2).sort((a, b) => daysTo(w, p, a.id) - daysTo(w, p, b.id))[0]
    return [school ? go(w, p, school.id, 0.9 * pri(d), 'Going somewhere with a medical school') : null]
  },

  /* ---------- Keep someone safe ---------- */
  protect(w, p, d) {
    const t = d.target != null ? w.people[d.target] : null
    if (!t || !t.alive) { d.failed = w.t; return [] }
    if (t === p) return []
    if (t.loc === p.loc && !t.trip) {
      const danger = t.plan?.k === 'hunt' || alive(w).some((q) => q.plan?.k === 'hunt' && q.plan.target === t.id)
      return [{ k: 'guard', u: (danger ? 2.6 : 0.7) * pri(d), why: `Watching over ${t.name}`, with: t.id, days: 2 }]
    }
    const wi = whereIs(w, p, t)
    if (wi) return [go(w, p, wi.place, 1.2 * pri(d), `Going to ${t.name}`)]
    return []
  },

  /* ---------- Rule ---------- */
  rule(w, p, d) {
    const opts: Option[] = []
    if (d.target == null) return [{ k: 'train', u: 0.6 * pri(d), why: 'Preparing to rule', days: 4 }]
    const org = w.orgs[d.target]
    if (org && org.leader === p.id) { d.prog = 100; return [{ k: 'duty', u: 1.2 * pri(d), why: `Leading the ${org.name}`, days: 4 }] }
    if (org) {
      opts.push({ k: 'campaign', u: 0.9 * pri(d), why: `Building support in the ${org.name}`, days: 4, run: () => campaign(w, p, org.id) })
      // The ruthless arrange accidents for whoever is ahead of them.
      const leader = w.people[org.leader]
      if (leader?.alive && leader !== p && p.facets.cruelty > 70 && p.facets.ambition > 85 && p.jenny > 300 && rng(w).chance(0.02)) {
        opts.push({ k: 'scheme', u: 1.5 * pri(d), why: `Arranging something for ${leader.name}`, days: 3, run: () => hireKiller(w, p, leader) })
      }
    }
    return opts
  },

  /* ---------- Money ---------- */
  wealth(w, p, d) {
    const opts: Option[] = [{ k: 'work', u: 0.9 * pri(d) * (1 + p.facets.greed / 150), why: 'Making money', days: 4 }]
    const cs = contractsFor(w, p)
    if (cs.length && (p.nen.lvl > 35 || p.skills.firearms > 60)) {
      const c = cs.sort((a, b) => b.reward - a.reward)[0]
      const t = c.target != null ? w.people[c.target] : null
      if (!t || power(p) > power(t) * 0.9) opts.push({ k: 'duty', u: 1.2 * pri(d) + c.reward / 500, why: `Taking a contract: ${c.k}${t ? ` on ${t.name}` : ''}`, days: 1, run: () => takeContract(w, p, c.id) })
    }
    if (w.places[p.loc].features.includes('casino') && p.facets.whimsy > 55) opts.push({ k: 'leisure', u: 0.5 * pri(d), why: 'Trying their luck at the tables', days: 1 })
    if (p.facets.honesty < 35 && p.facets.greed > 60) opts.push({ k: 'crime', u: 0.8 * pri(d), why: 'Stealing what they can', days: 3 })
    return opts
  },

  /* ---------- The Dark Continent ---------- */
  explore(w, p, d) {
    const exp = w.flags.expedition as { status: string; port: Id; depart: number } | undefined
    if (exp && exp.status === 'boarding') {
      if (p.flags.expedition) return [p.loc !== exp.port ? go(w, p, exp.port, 3 * pri(d), 'Joining the Dark Continent expedition') : { k: 'duty', u: 2 * pri(d), why: 'Waiting to sail', days: 2 }]
      return [{ k: 'campaign', u: 1.5 * pri(d), why: 'Trying to get a place on the expedition', days: 3, run: () => { if (p.nen.lvl > 45 || p.fame > 40 || rng(w).chance(0.05)) p.flags.expedition = 1 } }]
    }
    return [{ k: 'expedition', u: 0.7 * pri(d), why: 'Exploring the edges of the known world', days: 10 }]
  },

  /* ---------- Serve ---------- */
  serve(w, p, d) {
    if (d.target == null) return []
    const org = w.orgs[d.target]
    // Serving a person: be where they are.
    const master = d.tag === 'person' ? w.people[d.target] : null
    if (master) {
      if (!master.alive) { d.failed = w.t; return [] }
      if (master.loc !== p.loc && !master.trip) return [go(w, p, master.loc, 1.4 * pri(d), `Returning to ${master.name}`)]
      return [{ k: 'guard', u: 0.9 * pri(d), why: `Serving ${master.name}`, with: master.id, days: 3 }]
    }
    if (!org || org.dead) { d.failed = w.t; return [] }
    if (!inOrg(p, org.id)) return []
    if (p.loc !== org.hq && rng(w).chance(0.15)) return [go(w, p, org.hq, 0.7 * pri(d), `Reporting to the ${org.name}`)]
    return [{ k: 'duty', u: 0.8 * pri(d), why: `Working for the ${org.name}`, days: 4 }]
  },

  /* ---------- Greed Island ---------- */
  clear(w, p, d) {
    if (!p.nen.awake) return [{ k: 'train', u: 0.6 * pri(d), why: 'Learning Nen. Greed Island only lets Nen users in', days: 4 }]
    const gi = placeK(w, 'greed')
    if (p.loc === gi.id && !p.trip) return [{ k: 'game', u: 1.8 * pri(d), why: 'Playing Greed Island', days: 4 }]
    if (p.flags.giAccess) return [go(w, p, gi.id, 1.6 * pri(d), 'Entering Greed Island')]
    // Battera hires players every September in Yorknew.
    return [{ k: 'train', u: 0.5 * pri(d), why: 'Getting strong enough for Battera\'s selection', days: 4 }]
  },

  /* ---------- Make a name in one's field ---------- */
  discover(w, p, d) {
    const field = d.tag || 'beasts'
    const sites = w.places.filter((pl) => fieldFits(field, pl.features) && pl.kind !== 'beyond')
    if (!sites.length) return []
    const here = sites.find((s) => s.id === p.loc)
    if (here) return [{ k: 'expedition', u: 1.1 * pri(d), why: `Working in the field near ${here.name}`, days: 7, focus: field }]
    const s = sites.sort((a, b) => daysTo(w, p, a.id) - daysTo(w, p, b.id))[rng(w).int(Math.min(2, sites.length))]
    return [go(w, p, s.id, 0.8 * pri(d), `Setting out for ${s.name}`)]
  },

  /* ---------- Peace ---------- */
  peace(w, p, d) {
    const enemies = at(w, p.loc).filter((q) => q !== p && (q.rel[p.id]?.aff ?? 0) < -20)
    if (enemies.length) return [{ k: 'social', u: 1.2 * pri(d), why: `Trying to talk ${enemies[0].name} down`, with: enemies[0].id, days: 1 }]
    return [{ k: 'campaign', u: 0.6 * pri(d), why: 'Gathering people who want the same thing', days: 3, run: () => campaign(w, p, d.target ?? -1) }]
  },

  /* ---------- Make things interesting ---------- */
  chaos(w, p, d) {
    const r = rng(w)
    const opts: Option[] = []
    // Hisoka: find the strongest person nearby and see what they are made of.
    if (p.facets.aggression > 70 && p.nen.awake) {
      const strong = at(w, p.loc).filter((q) => q !== p && q.nen.awake && power(q) > power(p) * 0.55 && (q.rel[p.id]?.aff ?? 0) < 40)
      if (strong.length && p.hp > hpMax(p) * 0.8) {
        const q = strong.sort((a, b) => power(b) - power(a))[0]
        const unripe = q.nen.pot > 1.1 && power(q) < power(p) * 0.6
        if (!unripe) opts.push({ k: 'hunt', u: 1.6 * pri(d), why: `Testing ${q.name}`, days: 1, plan: { k: 'hunt', target: q.id, until: w.t + 10, why: 'for the thrill of it', data: { intent: 'duel' } } })
        else opts.push({ k: 'social', u: 0.9 * pri(d), why: `Watching ${q.name} grow`, with: q.id, days: 2 })
      }
      if (!strong.length) opts.push({ k: 'wander', u: 0.6 * pri(d), why: 'Looking for someone worth fighting', days: 5 })
    }
    // Pariston: lose on purpose, win by accident, stir everything.
    if (p.facets.sociability > 70 && p.facets.honesty < 30) {
      opts.push({ k: 'scheme', u: 0.8 * pri(d), why: 'Stirring things up', days: 3, run: () => stir(w, p) })
    }
    if (!opts.length) opts.push({ k: 'wander', u: 0.4 * pri(d), why: 'Looking for something interesting', days: 4 })
    void r
    return opts
  },

  /* ---------- Freedom ---------- */
  free(w, p, d) {
    const t = d.target != null ? w.people[d.target] : p
    if (!t || !t.alive) { d.failed = w.t; return [] }
    if (t === p) {
      // Leaving home on your own terms (Killua).
      const home = w.places[p.home]
      if (p.loc === home.id) return [{ k: 'travel', u: 1.4 * pri(d), why: 'Leaving home', place: pickAway(w, p) }]
      if (w.t - ((p.flags.leftHome as number) ?? w.t) > 120) { d.done = w.t }
      if (p.flags.leftHome == null) p.flags.leftHome = w.t
      return []
    }
    // Getting someone else out (Alluka).
    if (t.loc === p.loc && !t.trip) return [{ k: 'scheme', u: 2 * pri(d), why: `Taking ${t.name} away from here`, with: t.id, days: 2, run: () => freeSomeone(w, p, t, d) }]
    return [go(w, p, t.loc, 1.2 * pri(d), `Going to get ${t.name} out`)]
  },

  /* ---------- Teach ---------- */
  master(w, p, d) {
    if (!p.nen.awake || p.nen.lvl < 45) {
      // Training needs a teacher in the same room. Go to yours, or go where
      // teachers are: Heavens Arena, where every fighter past the 200th floor
      // uses Nen and the masters come to watch their students.
      const mentor = Object.keys(p.rel).map((id) => w.people[+id]).find((q) => q?.alive && hasBond(p.rel[q.id], 'mentor'))
      if (mentor && mentor.loc === p.loc) return [{ k: 'train', u: 1.5 * pri(d), why: `Training under ${mentor.name}`, days: 5 }]
      if (mentor && !mentor.trip && (p.rel[mentor.id]?.aff ?? 0) > 10) return [go(w, p, mentor.loc, 1.3 * pri(d), `Going back to ${mentor.name} to train`)]
      const arena = placeK(w, 'arena')
      if (!p.nen.awake && p.loc !== arena.id && p.species === 'human') return [go(w, p, arena.id, 1.2 * pri(d), 'Heading to Heavens Arena, where people learn Nen')]
      if (!p.nen.awake) return [{ k: 'arena', u: 1.1 * pri(d), why: 'Climbing Heavens Arena and looking for a teacher', days: 4 }, { k: 'train', u: 0.8 * pri(d), why: 'Training alone', days: 3 }]
      return [{ k: 'train', u: 0.9 * pri(d), why: 'Mastering the basics properly', days: 5 }]
    }
    if (p.role !== 'master' && p.nen.lvl >= 55 && age(w, p) >= 25 && !p.orgs.some((m) => ['troupe', 'zoldyck', 'ants'].includes(w.orgs[m.org].key))) p.role = 'master'
    const students = at(w, p.loc).filter((q) => hasBond(p.rel[q.id], 'student'))
    if (students.length) return [{ k: 'teach', u: 1.2 * pri(d), why: `Teaching ${students.map((s) => s.short).join(' and ')}`, with: students[0].id, days: 4 }]
    return [{ k: 'train', u: 0.6 * pri(d), why: 'Refining their own Nen', days: 4 }]
  },

  fame(w, p, d) {
    return [{ k: 'arena', u: 0.7 * pri(d), why: 'Making a name in the arena', days: 4 }]
  },

  family(w, p, d) {
    // Romance does the work; this keeps the wish alive and nudges dating.
    const q = firstBonded(w, p, 'spouse') || firstBonded(w, p, 'lover')
    if (q) {
      if (q?.alive && q.loc === p.loc) return [{ k: 'family', u: 0.9 * pri(d), why: `Spending time with ${q.name}`, with: q.id, days: 2 }]
      if (q?.alive) return [go(w, p, q.loc, 0.6 * pri(d), `Going home to ${q.name}`)]
    }
    return []
  },
}

/* ================= Steps that change the world ================= */

function found(w: World, p: Person, t: Person, d: Dream) {
  d.done = w.t
  change(w, p, t, { fam: 20, aff: 10 })
  change(w, t, p, { fam: 15, aff: 5 })
  const ev = log(w, { type: 'bond', imp: p.major || t.major || p.owned ? 4 : 2, who: [p.id, t.id], at: p.loc, text: `${P(p)} finds ${P(t)} at last, in ${L(w.places[p.loc])}.` })
  remember(w, p, { k: 'found', who: t.id, val: 60, str: 80, ev, text: `Found ${t.name}.` })
}

/** Someone who does not want to be found is gone by the time you arrive,
 *  leaving a trail warm enough to keep you going. Each near miss counts;
 *  the ones who keep coming, and have proved something, catch up in the end. */
function slipsAway(w: World, p: Person, t: Person): boolean {
  const r = rng(w)
  const elusive = (t.flags.elusive as number) || 0
  if (!elusive) return false
  const k = `near:${t.id}`
  const near = ((p.flags[k] as number) || 0) + 1
  p.flags[k] = near
  // He decides when. Persistence counts for a little; clearing his game and
  // making a name for yourself count for a lot.
  const tr = t.rel[p.id]
  const earned = (p.license ? 0.04 : 0) + (p.dreams.some((x) => x.k === 'clear' && x.done) ? 0.4 : 0) + Math.min(0.15, near * 0.02) + (p.fame > 40 ? 0.1 : 0) + ((tr?.resp ?? 0) > 85 ? 0.2 : 0)
  if (!r.chance(elusive - earned)) return false
  const away = w.places.filter((x) => x.id !== t.loc && !x.hidden && x.kind !== 'beyond' && !x.features.includes('game'))
  const dest = r.pick(away)
  travel(w, t, dest.id)
  p.seen[t.id] = [dest.id, w.t - 30]
  log(w, { type: 'misc', imp: p.owned ? 3 : p.major ? (near === 1 ? 3 : 2) : 1, who: [p.id, t.id], at: p.loc, text: `${P(p)} reaches ${L(w.places[p.loc])} a day after ${P(t)} left it. There is a rumour he was heading for ${L(dest)}.` })
  remember(w, p, { k: 'missed', who: t.id, val: -15, str: 35, text: `Just missed ${t.name}.` })
  return true
}

function searchFor(w: World, p: Person, t: Person, d: Dream) {
  const r = rng(w)
  // Ging Freecss does not want to be found, but he left a game behind.
  if (t.key === 'ging_freecss' && p.license && !p.flags.giClue && r.chance(0.12)) {
    p.flags.giClue = 1
    const f = addFact(w, { k: 'secret', s: t.id, d: 'made_gi', secret: 0.4, imp: 3, text: 'Ging Freecss is one of the creators of Greed Island.' })
    learn(w, p, f)
    const ev = log(w, { type: 'misc', imp: p.major || p.owned ? 3 : 1, who: [p.id, t.id], at: p.loc, text: `${P(p)} learns that ${P(t)} helped make Greed Island. If he left anything behind, it is in there.` })
    if (!p.dreams.some((x) => x.k === 'clear')) p.dreams.push({ k: 'clear', pri: Math.max(60, d.pri - 10), prog: 0, since: w.t, cause: ev })
    return
  }
  const elusive = (t.flags.elusive as number) || 0
  if (r.chance(1 - elusive)) investigate(w, p, t)
}

function vowDone(w: World, p: Person, d: Dream) {
  for (const v of p.nen.vows) if (v.org === d.target) v.kept = true
  p.nen.vows = p.nen.vows.filter((v) => v.org !== d.target)
  log(w, { type: 'vow', imp: p.major || p.owned ? 3 : 2, who: [p.id], at: p.loc, text: `Nothing is left of the organisation ${P(p)} swore to destroy. The vow is done.` })
}

function holderFactKey(w: World, itemId: Id): number {
  // Item knowledge is keyed as a negative pseudo-fact id per item, which is
  // cheap and never collides with real fact ids.
  return -1000 - itemId
}

function acquire(w: World, p: Person, itemId: Id, h: Person) {
  const r = rng(w)
  const it = w.items[itemId]
  if (!it || it.holder !== h.id) return
  const price = it.value * (1 + h.facets.greed / 200)
  const gives = () => {
    h.items = h.items.filter((x) => x !== it.id)
    it.holder = p.id
    p.items.push(it.id)
  }
  if (p.jenny >= price && r.chance(0.3 + h.facets.greed / 200)) {
    p.jenny -= price; h.jenny += price
    gives()
    log(w, { type: 'misc', imp: p.major || p.owned ? 3 : 1, who: [p.id, h.id], at: p.loc, text: `${P(p)} buys the ${it.name} from ${P(h)} for ${Math.round(price)} million Jenny.` })
    return
  }
  if (p.facets.honesty < 50 || p.mood.anger > 60 || p.dreams.some((d) => d.k === 'avenge')) {
    if (r.chance(0.15 + p.skills.stealth / 300)) {
      gives()
      change(w, h, p, { aff: -40, trust: -50 })
      log(w, { type: 'misc', imp: p.major || p.owned ? 3 : 1, who: [p.id, h.id], at: p.loc, text: `${P(p)} steals the ${it.name} from ${P(h)}.` })
    } else if (power(p) > power(h) * 1.2) {
      p.plan = { k: 'hunt', target: h.id, until: w.t + 10, why: `for the ${it.name}`, data: { intent: 'capture', item: it.id } }
    }
  }
}

function campaign(w: World, p: Person, orgId: Id) {
  const r = rng(w)
  const pool = orgId >= 0 ? members(w, orgId) : at(w, p.loc)
  for (let i = 0; i < 3 && pool.length; i++) {
    const q = r.pick(pool)
    if (q === p) continue
    change(w, q, p, { aff: (p.mind.charisma - 40) / 10 + r.next() * 3, resp: 1, fam: 2 })
  }
  p.fame += 0.2
}

function hireKiller(w: World, p: Person, t: Person) {
  const cost = 150 + t.fame * 5
  if (p.jenny < cost) return
  p.jenny -= cost
  const { postContract } = require_economy()
  postContract(w, { k: 'assassination', client: p.id, target: t.id, reward: cost, why: 'quietly' })
  addFact(w, { k: 'plan', s: p.id, o: t.id, d: 'hit', secret: 0.9, imp: 4, text: `${p.name} paid for ${t.name} to be killed.` })
}

export function takeContractPublic(w: World, p: Person, cid: Id) { takeContract(w, p, cid) }

function takeContract(w: World, p: Person, cid: Id) {
  const c = w.contracts.find((x) => x.id === cid)
  if (!c || c.status !== 'open') return
  c.status = 'taken'
  c.taker = p.id
  const t = c.target != null ? w.people[c.target] : null
  if (c.k === 'bodyguard' && t) {
    p.dreams.push({ k: 'protect', target: t.id, pri: 70, prog: 0, since: w.t })
    p.flags.contract = c.id
    if (c.client < 0) {
      const org = w.orgs[-c.client - 1]
      const { joinOrg } = require_orgs()
      joinOrg(w, p, org, 0, { title: 'Guard', text: `${P(p)} is hired by the ${O(org)} as a bodyguard for ${P(t)}.` })
    }
  } else if (t) {
    p.plan = { k: 'hunt', target: t.id, until: c.expires, why: c.k === 'bounty' ? 'for the bounty' : 'on a contract', data: { intent: c.k === 'bounty' ? 'capture' : 'kill', contract: c.id } }
    log(w, { type: 'job', imp: t.major || p.major ? 2 : 1, who: [p.id, t.id], at: p.loc, text: `${P(p)} takes the ${c.k === 'bounty' ? 'bounty' : 'contract'} on ${P(t)}, worth ${Math.round(c.reward)} million Jenny.` })
  }
}

function stir(w: World, p: Person) {
  const r = rng(w)
  const here = at(w, p.loc).filter((q) => q !== p)
  if (here.length < 2) return
  const a = r.pick(here), b = r.pick(here)
  if (a === b) return
  change(w, a, b, { aff: -8, trust: -10 })
  change(w, b, a, { aff: -6, trust: -8 })
  a.mood.anger = Math.min(100, a.mood.anger + 10)
  if (p.major && r.chance(0.2)) log(w, { type: 'social', imp: 1, who: [p.id, a.id, b.id], at: p.loc, text: `${P(p)} says something pleasant to ${P(a)} about ${P(b)}. By evening they are not speaking.` })
}

function freeSomeone(w: World, p: Person, t: Person, d: Dream) {
  // The family has to let them go, or be unable to stop it.
  const jailer = t.orgs.map((m) => w.orgs[m.org]).find((o) => o.key === 'zoldyck')
  const leader = jailer ? w.people[jailer.leader] : null
  const consent = !leader || !leader.alive || (leader.rel[p.id]?.aff ?? 0) > 50 && rng(w).chance(0.35) || power(p) > power(leader) * 0.7
  if (!consent) return
  d.done = w.t
  t.dreams.push({ k: 'protect', target: p.id, pri: 40, prog: 0, since: w.t })
  t.flags.freedBy = p.id
  if (!p.dreams.some((x) => x.k === 'protect' && x.target === t.id)) p.dreams.push({ k: 'protect', target: t.id, pri: 85, prog: 0, since: w.t })
  const ev = log(w, { type: 'bond', imp: p.major || t.major ? 4 : 2, who: [p.id, t.id], at: p.loc, text: `${P(p)} walks out of ${L(w.places[p.loc])} with ${P(t)}, and nobody stops them.` })
  remember(w, t, { k: 'freed', who: p.id, val: 80, str: 90, ev, text: `${p.name} took me out of there.` })
  t.loc = p.loc
  touch(w, t)
}

function pickAway(w: World, p: Person): Id {
  const ex = w.flags.exam as { place: Id } | undefined
  if (ex) return ex.place
  return placeK(w, 'arena').id
}

function fieldFits(field: string, f: string[]): boolean {
  if (field === 'beasts' || field === 'beast') return f.includes('beasts') || f.includes('wild')
  if (field === 'gourmet') return f.includes('wild') || f.includes('market')
  if (field === 'ruins' || field === 'treasure') return f.includes('ruins')
  if (field === 'sea') return f.includes('sea') || f.includes('fishing') || f.includes('harbor')
  if (field === 'virus') return f.includes('wild') || f.includes('jungle')
  return f.includes('wild')
}

function vowMultPreview(p: Person, t: Person): number {
  let m = 1
  for (const v of p.nen.vows) if (v.person === t.id || (v.org != null && t.orgs.some((x) => x.org === v.org))) m *= v.mult
  for (const h of p.nen.hatsu) if (h.conds.some((c) => c.k === 'target_only' && (c.people?.includes(t.id) || (c.org === -1 && t.orgs.length) || (c.org != null && t.orgs.some((x) => x.org === c.org))))) m *= 1.35
  return m
}

/* ================= Grief into action ================= */

/**
 * Someone the person loved was killed. Do they swear to avenge it? The answer
 * depends on how much they loved them, how vengeful and how brave they are,
 * and whether they even know who to blame. A player-owned character gets the
 * choice as a crossroad instead.
 */
export function considerVengeance(w: World, q: Person, killer: Person | null, dead: Person, ev: Id, love: number) {
  const r = rng(w)
  if (q.species === 'ant' && !q.flags.free) return
  const score = love * (q.facets.vengefulness / 100) * (0.55 + q.facets.bravery / 220) + q.mood.anger / 300 - q.facets.empathy / 900
  if (q.owned) {
    offerCrossroad(w, q, {
      title: `${dead.name} is dead`,
      prompt: killer ? `${dead.name} was killed by ${killer.name}. What does ${q.short} do with that?` : `${dead.name} was killed, and nobody knows by whom. What does ${q.short} do?`,
      options: [
        { k: 'avenge_vow', label: 'Swear a vow', desc: 'Bind their Nen to revenge. Far stronger against the killer, weaker at everything else.', fit: Math.min(1, score + 0.2) },
        { k: 'avenge', label: 'Hunt the killer', desc: 'Make revenge their purpose, without a vow.', fit: Math.min(1, score + 0.35) },
        { k: 'grieve', label: 'Grieve', desc: 'Mourn, and keep living.', fit: Math.max(0.2, 1 - score) },
        { k: 'forgive', label: 'Let it go', desc: 'Refuse to let it decide who they become.', fit: Math.max(0.1, q.facets.empathy / 100 - score / 2) },
      ],
      ctx: { killer: killer?.id ?? -1, dead: dead.id, ev },
    })
    return
  }
  if (score < 0.32) return
  const has = q.dreams.find((d) => d.k === 'avenge' && (d.target === killer?.id || (killer && d.tag === 'org' && killer.orgs.some((m) => m.org === d.target))))
  if (has) { has.pri = Math.min(100, has.pri + 10); return }
  // Against a notorious organisation, revenge widens to all of it (Kurapika).
  const org = killer?.orgs.map((m) => w.orgs[m.org]).find((o) => o.key === 'troupe' || o.key === 'ants' || o.kind === 'gang')
  const wide = org && q.facets.vengefulness > 85 && love > 0.85
  q.dreams.push(wide && org
    ? { k: 'avenge', target: org.id, tag: 'org', pri: Math.round(55 + score * 45), prog: 0, since: w.t, cause: ev }
    : killer ? { k: 'avenge', target: killer.id, pri: Math.round(50 + score * 45), prog: 0, since: w.t, cause: ev }
    : { k: 'avenge', target: -1, tag: String(dead.id), pri: Math.round(40 + score * 40), prog: 0, since: w.t, cause: ev })
  if (killer) setBond(w, q, killer, 'nemesis')
  const text = killer ? `${P(q)} swears to kill ${wide && org ? `every member of the ${O(org)}` : P(killer)} for ${P(dead)}.` : `${P(q)} swears to find whoever killed ${P(dead)}.`
  const e2 = log(w, { type: 'vow', imp: q.major || dead.major ? 3 : 2, who: killer ? [q.id, killer.id, dead.id] : [q.id, dead.id], at: q.loc, cause: ev, text })
  if (killer) startStory(w, 'vendetta', `${q.name} against ${killer.name}`, [q.id, killer.id], e2, `revenge-${q.id}-${killer.id}`)
  // The strongest grief binds Nen itself.
  if (killer && q.nen.awake && score > 0.62 && !q.nen.vows.length && ((q.rel[dead.id]?.fam ?? 0) >= 60 || isKin(q, dead.id)) && r.chance(0.18)) {
    const allIn = love > 0.9 && q.facets.impulsivity > 70 && q.facets.vengefulness > 70 && power(killer) > power(q) * 1.8 && q.nen.pot > 1.2
    if (allIn && r.chance(0.5)) swearAllIn(w, q, killer, e2)
    else swearVow(w, q, wide && org ? { org } : { person: killer }, score > 0.8 ? 5 : score > 0.7 ? 4 : 3, e2, `for ${dead.name}`)
  }
}

/** A newly made person's wants, read from their personality and role. */
export function seedDreams(w: World, p: Person) {
  const r = rng(w)
  const f = p.facets, v = p.values
  const add = (k: DreamKind, prio: number, target?: Id, tag?: string) => { if (!p.dreams.some((d) => d.k === k && d.target === target)) p.dreams.push({ k, pri: Math.round(Math.min(100, prio)), prog: 0, since: w.t, target, tag }) }
  if (!p.license && (f.ambition > 55 || f.curiosity > 65) && p.species === 'human' && age(w, p) < 40 && r.chance(0.5)) add('hunter', 40 + f.ambition / 2)
  if (f.ambition > 60 && (v.strength > 10 || f.aggression > 60)) add('strongest', 30 + f.ambition / 2)
  if (f.greed > 60 || v.wealth > 20) add('wealth', 30 + f.greed / 2)
  if (f.romantic > 55 && isAdult(w, p)) add('family', 25 + f.romantic / 2)
  if (f.curiosity > 70 && v.knowledge > 10) add('discover', 30 + f.curiosity / 2, undefined, r.pick(['beasts', 'gourmet', 'ruins', 'sea']))
  if (f.whimsy > 80 && f.cruelty > 60) add('chaos', 40 + f.whimsy / 3)
  if (f.empathy > 70 && v.knowledge > 0 && r.chance(0.2)) add('doctor', 40 + f.empathy / 3)
  for (const m of p.orgs) if (m.loyalty > 55) add('serve', 30 + m.loyalty / 2, m.org)
  if (!p.dreams.length) add(r.pick(['wealth', 'strongest', 'family', 'fame'] as DreamKind[]), 35)
}

/* Lazy requires break import cycles between dreams and the modules that use them. */
import * as Economy from '../society/economy'
import * as Orgs from '../society/orgs'
function require_economy() { return Economy }
function require_orgs() { return Orgs }

export { factById, knownKiller, personK, orgK, hpMax }
