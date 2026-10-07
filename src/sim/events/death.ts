/**
 * Death and everything it sets moving.
 *
 * A death is never just a line in the chronicle. The people who loved the
 * dead mourn, and the ones who are angry enough swear to avenge them, if they
 * know who did it. A leader's death opens a succession. A Spider's death
 * leaves a seat. A Nen user who dies hating their killer can leave their aura
 * clinging to them. Abilities stolen from the dead vanish from the thief's book.
 */
import { L, P, log } from '../history'
import type { Id, Person, World } from '../types'
import { at, rng, touch, members } from '../world'
import { addFact, knownKiller, learn, witness } from '../people/knowledge'
import { remember } from '../people/memory'
import { change, hasBond, isKin, lovedOnes } from '../people/relations'
import { onMemberDeath } from '../society/orgs'
import { considerVengeance } from '../people/dreams'
import { endStory, touchStories } from '../story/storyteller'

export interface KillOpts {
  cause: string
  by?: Person | null
  ev?: Id
  /** A short phrase for the death line when no event has been logged yet. */
  how?: string
  quiet?: boolean
}

export function kill(w: World, p: Person, o: KillOpts): Id {
  if (!p.alive) return o.ev ?? -1
  const r = rng(w)
  // Plot armour keeps canon characters and the player's own alive, at the
  // cost of being left for dead.
  if (w.laws.plotArmor && (p.canon || p.owned) && o.cause !== 'old age') {
    p.hp = 1
    p.conds.push({ k: 'unconscious', until: w.t + 5 })
    log(w, { type: 'misc', imp: p.major || p.owned ? 2 : 1, who: [p.id], at: p.loc, cause: o.ev, text: `${P(p)} should not have survived that, and somehow does.` })
    return o.ev ?? -1
  }
  const by = o.by && o.by.alive ? o.by : o.by || null
  p.alive = false
  p.hp = 0
  p.death = { t: w.t, at: p.trip ? p.trip.to : p.loc, cause: o.cause, by: by?.id, ev: o.ev }
  p.trip = undefined
  p.plan = null
  touch(w, p)
  let ev = o.ev
  if (ev == null) {
    const famous = p.major || p.fame >= 40 || p.owned
    ev = log(w, {
      type: 'death', imp: famous ? 4 : p.canon ? 3 : 2, who: by ? [p.id, by.id] : [p.id], at: p.death.at,
      text: o.how || `${P(p)} dies in ${L(w.places[p.death.at])}: ${o.cause}.`,
    })
  }
  p.death.ev = ev
  if (by) {
    by.stats.kills++
    by.infamy += 1 + p.fame * 0.1
  }
  // The dead hold nothing; what they carried stays where they fell.
  for (const id of p.items) {
    const it = w.items[id]
    if (it) { it.holder = -1; it.place = p.death.at }
  }
  p.items = []
  // Stolen abilities vanish when their original owner dies; a thief's book
  // releases what it held when the thief dies.
  for (const q of w.people) {
    if (!q.alive || !q.nen.stolen.length) continue
    const before = q.nen.stolen.length
    q.nen.stolen = q.nen.stolen.filter((h) => h.from !== p.id)
    if (q.nen.stolen.length < before && (q.major || q.owned)) {
      log(w, { type: 'nen', imp: 1, who: [q.id, p.id], at: q.loc, cause: ev, text: `A page in the book of ${P(q)} goes blank: ${P(p)} is dead, and the ability died with them.` })
    }
  }
  for (const h of p.nen.stolen) {
    const owner = w.people[h.from!]
    if (owner && owner.alive && !owner.nen.hatsu.some((x) => x.name === h.name)) {
      owner.nen.hatsu.push({ ...h, from: undefined })
      log(w, { type: 'nen', imp: owner.major ? 2 : 1, who: [owner.id, p.id], at: owner.loc, cause: ev, text: `"${h.name}" returns to ${P(owner)} now that ${P(p)} is dead.` })
    }
  }
  p.nen.stolen = []
  // Witnesses, and the killer, know who did it.
  if (by) {
    const crime = addFact(w, { k: 'crime', s: by.id, o: p.id, d: 'kill', secret: 0.4, imp: 3 + (p.fame > 40 ? 1 : 0), text: `${by.name} killed ${p.name}.`, ev })
    learn(w, by, crime)
    witness(w, crime, at(w, p.death.at))
    if (p.fame > 55 || by.fame > 60) crime.secret = Math.min(crime.secret, 0.15)
  }
  // Nen after death: hatred that outlives its owner.
  if (by && w.laws.postmortem && p.nen.awake && p.nen.lvl > 35) {
    const hate = Math.max(0, -(p.rel[by.id]?.aff ?? 0)) / 100 + (p.nen.vows.some((v) => v.person === by.id) ? 0.4 : 0)
    if (r.chance(Math.min(0.7, 0.005 + hate * 0.5 + Math.max(0, p.facets.vengefulness - 60) / 600))) {
      by.conds.push({ k: 'curse', until: w.t + 300 + r.int(400), by: p.id, p: 0.75, note: `the aura of ${p.name}` })
      log(w, { type: 'nen', imp: by.major || p.major ? 3 : 2, who: [by.id, p.id], at: by.loc, cause: ev, text: `The aura of ${P(p)} does not die with them. It clings to ${P(by)}, weakening them, and will not let go unless an exorcist removes it.` })
    }
  }
  // Organisations
  for (const m of p.orgs) onMemberDeath(w, w.orgs[m.org], p, by, ev)
  // Parties
  if (p.party != null) {
    const pt = w.parties.find((x) => x.id === p.party)
    if (pt) {
      pt.members = pt.members.filter((x) => x !== p.id)
      if (pt.leader === p.id) pt.leader = pt.members[0] ?? -1
    }
  }
  // Contracts that named them
  for (const c of w.contracts) {
    if (c.status !== 'open' && c.status !== 'taken') continue
    if (c.target === p.id) c.status = by && c.taker === by.id ? 'done' : 'void'
    if (c.taker === p.id) { c.status = 'open'; c.taker = undefined }
    if (c.client === p.id) c.status = 'void'
  }
  // Grief, and what grief turns into.
  if (!o.quiet) mourn(w, p, by, ev)
  touchStories(w, ev, [p.id, ...(by ? [by.id] : [])])
  return ev
}

function mourn(w: World, dead: Person, by: Person | null, ev: Id) {
  const r = rng(w)
  const mourners: Person[] = []
  for (const q of w.people) {
    if (!q.alive || q === by) continue
    const rq = q.rel[dead.id]
    if (!rq) continue
    if (rq.aff >= 45 || (isKin(q, dead.id) && rq.aff > 5) || hasBond(rq, 'bestFriend') || hasBond(rq, 'comrade') && rq.aff > 30) mourners.push(q)
  }
  mourners.sort((a, b) => (b.rel[dead.id].aff) - (a.rel[dead.id].aff))
  let named = 0
  for (const q of mourners) {
    const rq = q.rel[dead.id]
    // How much someone meant: how warmly, and for how long.
    const love = Math.max(rq.aff * Math.min(1, 0.4 + rq.fam / 100), isKin(q, dead.id) ? 60 : 0) / 100
    q.mood.grief = Math.min(100, q.mood.grief + 30 + love * 50)
    q.mood.anger = Math.min(100, q.mood.anger + love * 35 * (q.facets.vengefulness / 60))
    remember(w, q, { k: 'loss', who: dead.id, val: -80 * love, str: 60 + love * 35, ev, text: `${dead.name} died${by ? `, killed by ${by.name}` : ''}.` })
    // Do they know who did it?
    let killer: Person | null = null
    if (by) {
      const kk = knownKiller(w, q, dead.id)
      if (kk === by.id || q.loc === dead.death!.at || r.chance(0.35 + (dead.fame + by.fame) / 300)) {
        killer = by
        const f = w.facts.find((f) => f.k === 'crime' && f.o === dead.id && f.s === by.id)
        if (f) learn(w, q, f)
      }
    }
    if (killer) {
      change(w, q, killer, { aff: -60 * love - 15, trust: -40, fear: dead.nen.lvl > q.nen.lvl ? 15 : 0 })
      considerVengeance(w, q, killer, dead, ev, love)
    } else if (by) {
      // They know someone did it, not who. That becomes its own hunt.
      considerVengeance(w, q, null, dead, ev, love)
    }
    if (named < 3 && (q.major || q.owned || dead.major)) {
      named++
      if (!killer || !(q.dreams.some((d) => d.k === 'avenge' && d.target === killer!.id))) {
        log(w, { type: 'bond', imp: q.major || q.owned ? 2 : 1, who: [q.id, dead.id], at: q.loc, cause: ev, text: `${P(q)} mourns ${P(dead)}.` })
      }
    }
  }
  // A comrade's death binds the survivors closer, or breaks them.
  const orgs = dead.orgs.map((m) => m.org)
  for (const oid of orgs) {
    for (const m of members(w, oid)) if (m.rel[dead.id] && m.rel[dead.id].aff > 20) m.mood.anger = Math.min(100, m.mood.anger + 10)
  }
  // A hunt for the dead ends with them.
  const how = by ? `${dead.name} was killed by ${by.name}.` : `${dead.name} died before anyone could reach them.`
  endStory(w, `revenge-on-${dead.id}`, ev, how)
  endStory(w, `contract-on-${dead.id}`, ev, how)
  // Dreams that depended on the dead come to an end.
  for (const q of w.people) {
    if (!q.alive) continue
    for (const d of q.dreams) {
      if (d.done || d.failed || d.target !== dead.id) continue
      if (d.k === 'protect') { d.failed = w.t; q.mood.grief = Math.min(100, q.mood.grief + 25) }
      else if (d.k === 'defeat') {
        d.failed = w.t
        if (by && by !== q) log(w, { type: 'misc', imp: q.major ? 2 : 1, who: [q.id, dead.id], at: q.loc, cause: ev, text: `${P(q)} will never get the fight with ${P(dead)} they wanted.` })
      } else if (d.k === 'find' || d.k === 'serve' || d.k === 'free') d.failed = w.t
      else if (d.k === 'avenge' && d.tag !== 'org') {
        if (by && by.id === q.id) d.done = w.t
        else {
          d.failed = w.t
          log(w, { type: 'vow', imp: q.major ? 2 : 1, who: [q.id, dead.id], at: q.loc, cause: ev, text: `${P(dead)} is dead by another hand. The revenge of ${P(q)} ends unfinished.` })
        }
        for (const v of q.nen.vows) if (v.person === dead.id) { v.kept = by?.id === q.id; v.broken = false }
        q.nen.vows = q.nen.vows.filter((v) => v.person !== dead.id)
      }
    }
  }
  void lovedOnes
}
