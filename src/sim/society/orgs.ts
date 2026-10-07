/**
 * Organisations: who belongs, who leads, what happens when members die, and
 * what each organisation decides to do week by week.
 *
 * Each organisation runs the same machinery (members, ranks, a treasury,
 * operations, tension with others) and has its own doctrine on top: the
 * Troupe raids and avenges; the Association examines, licenses, hunts
 * criminals and answers crises; the Zoldycks take contracts; the Mafia
 * protects its auction and hires killers; Kakin plays for the throne.
 */
import { L, O, P, log } from '../history'
import type { Id, Membership, Org, OrgOp, Person, World } from '../types'
import { alive, at, members, orgK, rng, touch, placeK, personK } from '../world'
import { power, inOrg, age } from '../people/person'
import { change, setBond, hasBond } from '../people/relations'
import { remember } from '../people/memory'
import { addFact, learn, knownKiller } from '../people/knowledge'
import { postContract } from './economy'
import { startElection } from './election'
import { touchStories, startStory } from '../story/storyteller'

export function membership(p: Person, org: Id): Membership | undefined {
  return p.orgs.find((m) => m.org === org)
}

export function joinOrg(w: World, p: Person, org: Org, rank = 0, o: { title?: string; num?: number; secret?: boolean; text?: string; cause?: Id; quiet?: boolean; loyalty?: number } = {}) {
  if (inOrg(p, org.id)) return
  p.orgs.push({ org: org.id, rank, t: w.t, loyalty: o.loyalty ?? 55, title: o.title, num: o.num, secret: o.secret })
  for (const m of members(w, org.id)) {
    if (m === p) continue
    setBond(w, p, m, 'comrade')
    change(w, p, m, { aff: 6, fam: 5 })
    change(w, m, p, { aff: 4, fam: 5 })
  }
  if (org.dead) { org.dead = false; org.leader = p.id }
  if (org.leader < 0 || !w.people[org.leader]?.alive) org.leader = p.id
  touch(w)
  if (!o.quiet) {
    log(w, { type: 'faction', imp: p.major || p.owned || org.key === 'troupe' ? 3 : 2, who: [p.id], at: p.loc, orgs: [org.id], cause: o.cause, text: o.text || `${P(p)} joins the ${O(org)}.` })
  }
  remember(w, p, { k: 'join', val: 25, str: 40, text: `Joined the ${org.name}.` })
}

export function leaveOrg(w: World, p: Person, org: Org, why: 'quit' | 'expelled' | 'defected', cause?: Id, text?: string): Id {
  const m = membership(p, org.id)
  if (!m) return -1
  p.orgs = p.orgs.filter((x) => x.org !== org.id)
  for (const q of members(w, org.id)) {
    if (q === p) continue
    setBond(w, p, q, 'comrade', false)
    if (why !== 'quit') change(w, q, p, { aff: -25, trust: -40 })
  }
  touch(w)
  const ev = log(w, {
    type: 'faction', imp: p.major || p.owned || org.leader === p.id ? 3 : 2, who: [p.id], at: p.loc, orgs: [org.id], cause,
    text: text || (why === 'quit' ? `${P(p)} leaves the ${O(org)}.` : why === 'expelled' ? `The ${O(org)} expels ${P(p)}.` : `${P(p)} turns against the ${O(org)}.`),
  })
  if (org.leader === p.id) succession(w, org, ev)
  return ev
}

/* ================= Death of a member ================= */

export function onMemberDeath(w: World, org: Org, p: Person, by: Person | null, ev: Id) {
  const r = rng(w)
  const left = members(w, org.id).filter((m) => m.alive && m !== p)
  if (org.leader === p.id) succession(w, org, ev)
  if (!left.length) {
    if (!org.dead) {
      org.dead = true
      if (org.kind !== 'bloc') log(w, { type: 'faction', imp: 3, orgs: [org.id], cause: ev, text: `The ${O(org)} has no one left. It is finished.` })
    }
    return
  }
  switch (org.key) {
    case 'troupe': {
      // Rule 4: the seat can go to whoever killed its holder.
      const num = membership(p, org.id)?.num
      org.flags.vacant = ((org.flags.vacant as number) || 0) + 1
      if (num != null) org.flags[`seat${num}`] = 'empty'
      // Custom: a leg that is cut off is paid for.
      if (by && !inOrg(by, org.id)) {
        const knowers = left.filter((m) => knownKiller(w, m, p.id) === by.id)
        const op: OrgOp = { k: 'vendetta', target: by.id, due: w.t + 120, start: w.t, members: left.map((m) => m.id), ev }
        org.ops.push(op)
        if (knowers.length) {
          log(w, { type: 'faction', imp: 3, who: [by.id, p.id], orgs: [org.id], cause: ev, text: `The Phantom Troupe will make ${P(by)} pay for ${P(p)}.` })
        } else {
          log(w, { type: 'faction', imp: 3, who: [p.id], orgs: [org.id], cause: ev, text: `The Phantom Troupe goes looking for whoever killed ${P(p)}.` })
        }
        startStory(w, 'vendetta', `The Spider hunts ${by.name}`, [by.id, ...left.slice(0, 4).map((m) => m.id)], ev, `spider-${by.id}`)
      }
      break
    }
    case 'mafia': case 'nostrade': {
      if (by && !inOrg(by, org.id)) by.flags.wrongedMafia = 1
      if (by && !inOrg(by, org.id) && org.treasury > 50) {
        postContract(w, { k: 'bounty', client: -org.id - 1, target: by.id, reward: Math.min(org.treasury * 0.2, 200 + p.fame * 5), why: `for killing ${p.name}`, cause: ev })
      }
      break
    }
    case 'ants': {
      const queen = left.find((m) => m.title === 'Queen')
      if (p.title === 'Queen') {
        log(w, { type: 'faction', imp: 4, orgs: [org.id], cause: ev, text: `The Chimera Ant Queen is dead. Without her, the colony breaks apart. Squadron leaders who were held by instinct are free to choose.` })
        for (const m of left) if (m.title === 'Squadron Leader') m.flags.free = 1
      }
      if (p.title === 'King') {
        log(w, { type: 'faction', imp: 5, orgs: [org.id], cause: ev, text: `The King of the Chimera Ants is dead. The swarm that existed to serve him has nothing to serve.` })
        for (const m of left) { m.flags.free = 1; if (m.title === 'Royal Guard') m.mood.grief = 100 }
      }
      void queen
      break
    }
    case 'kakin_royal': {
      if (w.flags.succession && p.title && /Prince/.test(p.title)) {
        const heirs = left.filter((m) => m.title && /Prince/.test(m.title))
        log(w, { type: 'faction', imp: 3, who: [p.id], orgs: [org.id], cause: ev, text: `${heirs.length} ${heirs.length === 1 ? 'heir remains' : 'heirs remain'} in the Kakin succession war.` })
      }
      break
    }
  }
  // Grief inside the organisation hardens loyalty, or breaks it.
  for (const m of left) {
    const mm = membership(m, org.id)
    if (!mm) continue
    if ((m.rel[p.id]?.aff ?? 0) > 40) mm.loyalty = Math.min(100, mm.loyalty + 5)
  }
  touchStories(w, ev, [p.id])
}

/* ================= Succession ================= */

export function succession(w: World, org: Org, cause?: Id) {
  const ms = members(w, org.id).filter((m) => m.alive && m.id !== org.leader)
  if (!ms.length) { org.leader = -1; return }
  let next: Person | undefined
  switch (org.key) {
    case 'ha': {
      // Article 9: the vote is held at once; the Vice-Chairman holds deputy power.
      const vice = ms.find((m) => membership(m, org.id)?.title === 'Vice-Chairman') || ms.sort((a, b) => (membership(b, org.id)!.rank - membership(a, org.id)!.rank) || b.fame - a.fame)[0]
      org.leader = vice.id
      startElection(w, org, cause)
      return
    }
    case 'kakin_royal': {
      if (w.flags.succession) return
      next = ms.filter((m) => m.title && /Prince/.test(m.title)).sort((a, b) => (membership(a, org.id)?.num ?? 99) - (membership(b, org.id)?.num ?? 99))[0]
      if (next) next.title = 'King'
      break
    }
    case 'troupe': {
      // The Spider lives on. The legs agree on the strongest, or toss a coin.
      next = ms.sort((a, b) => power(b) + (b.rel[org.leader]?.aff ?? 0) / 4 - power(a) - (a.rel[org.leader]?.aff ?? 0) / 4)[0]
      break
    }
    case 'zoldyck': {
      next = ms.filter((m) => (membership(m, org.id)?.rank ?? 0) >= 2 && age(w, m) >= 18).sort((a, b) => power(b) - power(a))[0]
      break
    }
    case 'ants': return
    default:
      next = ms.sort((a, b) => (membership(b, org.id)!.rank - membership(a, org.id)!.rank) * 30 + power(b) + b.fame / 3 - power(a) - a.fame / 3)[0]
  }
  if (!next) next = ms[0]
  org.leader = next.id
  const mm = membership(next, org.id)
  if (mm) mm.rank = Math.max(mm.rank, org.ranks.length - 1)
  next.fame += 6
  log(w, { type: 'faction', imp: 3, who: [next.id], orgs: [org.id], cause, at: next.loc, text: `${P(next)} now leads the ${O(org)}.` })
}

/* ================= Weekly doctrine ================= */

export function orgsWeekly(w: World) {
  for (const org of w.orgs) {
    if (org.dead) continue
    switch (org.key) {
      case 'troupe': troupeWeekly(w, org); break
      case 'ha': haWeekly(w, org); break
      case 'mafia': mafiaWeekly(w, org); break
      case 'nostrade': nostradeWeekly(w, org); break
      case 'zoldyck': zoldyckWeekly(w, org); break
    }
    // Every organisation's treasury tracks its members' work.
    org.treasury = Math.max(0, org.treasury)
    // Tension cools.
    for (const k in org.tension) org.tension[k] = Math.max(0, org.tension[k] - 0.6)
  }
}

export function addTension(w: World, a: Org, b: Org, v: number) {
  if (a === b) return
  a.tension[b.id] = Math.min(100, (a.tension[b.id] || 0) + v)
  b.tension[a.id] = Math.min(100, (b.tension[a.id] || 0) + v)
}

/* ---------------- Phantom Troupe ---------------- */

function troupeWeekly(w: World, org: Org) {
  const r = rng(w)
  const ms = members(w, org.id).filter((m) => !m.orgs.find((x) => x.org === org.id)?.secret || true)
  const head = w.people[org.leader]
  const date = new Date((w.epoch + w.t) * 86400000)
  const month = date.getUTCMonth()
  // The Yorknew auction is in September. Chrollo decides in summer.
  const raid = org.ops.find((o) => o.k === 'raid')
  if (!raid && head?.alive && month === 6 && date.getUTCDate() <= 7 && !w.flags[`troupeRaid${date.getUTCFullYear()}`]) {
    w.flags[`troupeRaid${date.getUTCFullYear()}`] = 1
    // Once the auction has been hit, it is guarded; they come back only now and then.
    const hitBefore = Object.keys(w.flags).some((k) => k.startsWith('troupeHit'))
    if (r.chance(hitBefore ? 0.18 : 0.55 + head.facets.greed / 300)) {
      w.flags[`troupeHit${date.getUTCFullYear()}`] = 1
      const yk = placeK(w, 'yorknew')
      const due = w.t + 50 + r.int(10)
      const ev = log(w, { type: 'faction', imp: 4, who: [head.id], at: head.loc, orgs: [org.id], text: hitBefore
        ? `${P(head)} calls the Phantom Troupe together again. They have hit the Yorknew auction before. They are going to do it again.`
        : `${P(head)} calls the whole Phantom Troupe together for the first time in years. The target: the Yorknew underground auction. "Take everything."` })
      org.ops.push({ k: 'raid', place: yk.id, due, start: w.t, members: ms.map((m) => m.id), ev, data: { auction: true } })
      startStory(w, 'heist', 'The Troupe comes to Yorknew', ms.slice(0, 6).map((m) => m.id), ev, `raid-${date.getUTCFullYear()}`)
      // Secret, but the Mafia's fortune tellers and informants may hear.
      const f = addFact(w, { k: 'plan', s: head.id, o: org.id, d: 'raid:yorknew', secret: 0.7, imp: 4, text: 'The Phantom Troupe is going to raid the Yorknew auction.' })
      for (const m of ms) learn(w, m, f)
    }
  } else if (!raid && head?.alive && r.chance(0.006) && ms.length >= 5) {
    const targets = w.places.filter((p) => p.wealth > 0.65 && !p.features.includes('game') && p.kind !== 'beyond')
    const tgt = r.pick(targets)
    const ev = log(w, { type: 'faction', imp: 3, who: [head.id], orgs: [org.id], text: `The Phantom Troupe gathers. The target is ${L(tgt)}.` })
    org.ops.push({ k: 'raid', place: tgt.id, due: w.t + 25 + r.int(15), start: w.t, members: ms.map((m) => m.id), ev })
  }
  // Fill empty seats with someone strong and unattached.
  const seats = org.seats || 13
  if (ms.length < seats && r.chance(0.06)) {
    const cands = alive(w).filter((p) => !p.orgs.length && p.nen.lvl > 50 && p.facets.cruelty > 50 && p.values.law < 0 && !p.canon && !p.owned && p.facets.loyalty > 40)
    const c = cands.length ? r.pick(cands) : null
    if (c) {
      const used = new Set(ms.map((m) => membership(m, org.id)?.num))
      let num = 1
      while (used.has(num) && num < 13) num++
      joinOrg(w, c, org, 0, { num, title: `No. ${num}`, text: `${P(c)} takes the empty seat No. ${num} in the Phantom Troupe. A spider is tattooed on them with the number.` })
    }
  }
  // Vendettas: hunt the killer of a leg.
  for (const op of org.ops.filter((o) => o.k === 'vendetta')) {
    const tgt = w.people[op.target!]
    if (!tgt || !tgt.alive || w.t > op.due) { org.ops = org.ops.filter((o) => o !== op); continue }
    for (const m of members(w, org.id)) {
      if (m.plan?.k === 'hunt' || m.conds.some((c) => c.k === 'judgment')) continue
      if (knownKiller(w, m, -1) != null) void 0
      if (r.chance(0.35)) m.plan = { k: 'hunt', target: tgt.id, until: op.due, why: 'to avenge a fallen Spider', ev: op.ev, data: { intent: 'kill' } }
    }
  }
}

/* ---------------- Hunter Association ---------------- */

function haWeekly(w: World, org: Org) {
  const r = rng(w)
  // Article 5-7: stars, by deeds.
  for (const m of members(w, org.id)) {
    const lic = m.license
    if (!lic) continue
    if (lic.stars === 0 && m.fame >= 45 && r.chance(0.08)) promote(w, m, 1)
    else if (lic.stars === 1 && m.fame >= 90 && (membership(m, org.id)!.rank >= 1 || m.stats.saved > 2) && r.chance(0.05)) promote(w, m, 2)
    else if (lic.stars === 2 && m.fame >= 150 && r.chance(0.03)) promote(w, m, 3)
  }
  // The Association posts bounties on the worst criminals it knows of.
  if (r.chance(0.12)) {
    // Heinous criminals: the Troupe and its like, and anyone who has killed
    // repeatedly in the open. The Zoldycks are not touched; everyone knows why.
    const crims = alive(w).filter((p) => p.species === 'human' && !inOrg(p, org.id) && p.bounty < 50 && !p.orgs.some((m) => w.orgs[m.org].key === 'zoldyck')
      && (p.orgs.some((m) => ['troupe', 'bombers'].includes(w.orgs[m.org].key) && !m.secret) || (p.stats.kills >= 3 && p.infamy > 30) || p.flags.robbedMafia))
    if (crims.length) {
      const c = crims.sort((a, b) => b.infamy - a.infamy)[0]
      c.bounty = Math.max(c.bounty, 50 + c.infamy * 2)
      postContract(w, { k: 'bounty', client: -org.id - 1, target: c.id, reward: c.bounty, why: 'on the Association\'s blacklist' })
      log(w, { type: 'faction', imp: c.fame > 40 ? 3 : 2, who: [c.id], orgs: [org.id], text: `The Hunter Association puts ${P(c)} on its blacklist. Bounty: ${Math.round(c.bounty)} million Jenny.` })
    }
  }
  // Empty Zodiac seats are filled by the Chairman's choice.
  const zod = orgK(w, 'zodiacs')
  const zs = members(w, zod.id)
  const chair = w.people[org.leader]
  if (zs.length < 12 && chair?.alive && r.chance(0.04)) {
    const cands = members(w, org.id).filter((m) => m !== chair && !inOrg(m, zod.id) && m.license && m.license.stars >= 1 && m.nen.lvl > 55 && age(w, m) >= 20)
    if (cands.length) {
      const c = cands.sort((a, b) => b.fame + power(b) - a.fame - power(a))[0]
      const signs = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Sheep', 'Monkey', 'Rooster', 'Dog', 'Boar']
      const used = new Set(zs.map((z) => membership(z, zod.id)?.title))
      const sign = signs.find((s) => !used.has(s)) || 'Boar'
      joinOrg(w, c, zod, 0, { title: sign, text: `${P(chair)} names ${P(c)} to the Zodiacs as the ${sign}.` })
      const hm = membership(c, org.id)
      if (hm) { hm.rank = Math.max(hm.rank, 1); hm.title = sign }
    }
  }
}

function promote(w: World, p: Person, stars: number) {
  if (!p.license) return
  p.license.stars = stars
  p.fame += 6 * stars
  log(w, { type: 'exam', imp: p.major || p.owned ? 3 : 2, who: [p.id], at: p.loc, text: `The Hunter Association names ${P(p)} a ${['', 'Single', 'Double', 'Triple'][stars]} Star Hunter.` })
  remember(w, p, { k: 'star', val: 45, str: 55, text: `Became a ${stars}-star Hunter.` })
}

/* ---------------- Mafia ---------------- */

function mafiaWeekly(w: World, org: Org) {
  const r = rng(w)
  // Insults and losses become contracts for the Zoldycks.
  const zold = orgK(w, 'zoldyck')
  if (org.treasury > 300 && r.chance(0.03)) {
    const enemies = alive(w).filter((p) => p.flags.robbedMafia || p.flags.wrongedMafia)
    if (enemies.length && !zold.dead) {
      const t = r.pick(enemies)
      postContract(w, { k: 'assassination', client: -org.id - 1, target: t.id, reward: Math.min(org.treasury * 0.25, 300 + t.fame * 8), why: 'for the Mafia Community' })
    }
  }
  org.treasury += 6
}

function nostradeWeekly(w: World, org: Org) {
  const r = rng(w)
  // Before the auction the family hires Nen users to guard Neon.
  const date = new Date((w.epoch + w.t) * 86400000)
  const y = date.getUTCFullYear()
  if (date.getUTCMonth() === 6 && !w.flags[`nostradeHire${y}`]) {
    w.flags[`nostradeHire${y}`] = 1
    const neon = personK(w, 'neon_nostrade')
    if (neon?.alive) {
      for (let i = 0; i < 3; i++) postContract(w, { k: 'bodyguard', client: -org.id - 1, target: neon.id, reward: 30 + r.int(30), why: 'guarding Neon Nostrade through the Yorknew auction', place: placeK(w, 'yorknew').id, days: 90 })
      log(w, { type: 'faction', imp: 2, orgs: [org.id], at: placeK(w, 'yorknew').id, text: `The Nostrade family advertises for bodyguards with Nen, to protect Neon through the Yorknew auction. The pay is very good.` })
    }
  }
}

/* ---------------- Zoldyck ---------------- */

function zoldyckWeekly(w: World, org: Org) {
  // The family accepts open assassination contracts that pay enough.
  for (const c of w.contracts) {
    if (c.status !== 'open' || c.k !== 'assassination') continue
    const t = w.people[c.target!]
    if (!t || !t.alive || inOrg(t, org.id)) continue
    const avail = members(w, org.id).filter((m) => m.role === 'assassin' && !m.plan && m.nen.lvl > 40 && age(w, m) >= 16 && !m.conds.length)
    if (!avail.length) continue
    // Never take a job you cannot finish.
    const pick = avail.filter((m) => power(m) > power(t) * 1.15).sort((a, b) => power(a) - power(b))[0]
    if (!pick || c.reward < 80) continue
    c.status = 'taken'
    c.taker = pick.id
    pick.plan = { k: 'hunt', target: t.id, until: w.t + 90, why: 'on a contract', data: { intent: 'kill', contract: c.id } }
    const ev = log(w, { type: 'faction', imp: t.major || t.fame > 40 ? 3 : 2, who: [pick.id, t.id], orgs: [org.id], at: pick.loc, cause: c.ev, text: `The Zoldyck family accepts a contract on ${P(t)} for ${Math.round(c.reward)} million Jenny. ${P(pick)} takes the job.` })
    c.ev = ev
    startStory(w, 'contract', `A Zoldyck contract on ${t.name}`, [pick.id, t.id], ev, `contract-${c.id}`)
  }
}

export { hasBond, at }
