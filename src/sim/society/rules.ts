/**
 * Organisational rules as things that actually happen.
 *
 * Rules work in two directions. Before someone acts, `restraint` tells the
 * decision-maker how much a rule weighs against the act: a disciplined,
 * loyal Hunter will not go after another Hunter; a reckless one might anyway.
 * After a fight, `breachRules` checks whether anyone just broke a rule of
 * their own organisation, and the organisation answers: a coin toss, an
 * expulsion, a blacklisting, a hunt.
 */
import { O, P, log } from '../history'
import type { Id, Org, Person, World } from '../types'
import { orgK, rng, members } from '../world'
import { inOrg } from '../people/person'
import { leaveOrg, membership } from './orgs'
import { postContract } from './economy'
import type { F, FightOpts, FightResult } from '../combat/combat'

/** Is this person someone the Association would call a heinous criminal? */
export function isHeinous(w: World, p: Person): boolean {
  return p.infamy > 35 || p.bounty > 0 || p.orgs.some((m) => ['troupe', 'bombers', 'ants'].includes(w.orgs[m.org].key))
}

/**
 * How much a person's rules weigh against attacking someone, 0 (forbidden in
 * their eyes) to 1 (no objection).
 */
export function restraint(w: World, p: Person, target: Person, intent: string): number {
  if (intent === 'spar' || intent === 'arena') return 1
  let x = 1
  const disc = (p.facets.discipline + p.facets.loyalty) / 200
  // Hunter Bylaw 4.
  if (p.license && target.license && !isHeinous(w, target)) x *= 1 - 0.85 * disc
  for (const m of p.orgs) {
    const org = w.orgs[m.org]
    if (!target.orgs.some((n) => n.org === org.id)) continue
    // Rule 2 of the Troupe; family rules; military discipline.
    if (org.key === 'troupe') x *= 0.04
    else if (org.key === 'zoldyck') x *= 0.03
    else if (org.kind === 'military' || org.kind === 'association') x *= 0.2 + (1 - disc) * 0.3
    else if (org.key === 'kakin_royal' && w.flags.succession && /Prince/.test(p.title || '') && /Prince/.test(target.title || '')) x *= 1
    else x *= 0.4
  }
  // Zoldycks do not kill for free.
  if (p.orgs.some((m) => w.orgs[m.org].key === 'zoldyck') && intent === 'kill' && !p.plan?.data?.contract) x *= 0.25
  return x
}

export function logRule(w: World, org: Org, rule: string, who: Id, outcome: string, ev?: Id) {
  org.rulesLog.push({ t: w.t, rule, who, outcome, ev })
  if (org.rulesLog.length > 40) org.rulesLog.shift()
}

export function breachRules(w: World, F: F[], res: FightResult, o: FightOpts, ev: Id, dead: Person[]) {
  if (o.intentA === 'spar' || o.arena) return
  const r = rng(w)
  const ha = orgK(w, 'ha')
  const named = F.filter((f) => f.p)
  for (const a of named) {
    if (a.side !== 0) continue
    const p = a.p!
    for (const b of named) {
      if (b.side === a.side) continue
      const q = b.p!
      // Article 4: a Hunter attacked a Hunter who was no criminal.
      if (p.license && q.license && inOrg(p, ha.id) && !isHeinous(w, q) && (o.intentA === 'kill' || o.intentA === 'capture')) {
        p.infamy += 15
        p.bounty = Math.max(p.bounty, 80)
        postContract(w, { k: 'bounty', client: -ha.id - 1, target: p.id, reward: 80 + q.fame, why: 'for breaking Article 4', cause: ev })
        const e2 = log(w, { type: 'law', imp: p.major || q.major ? 3 : 2, who: [p.id, q.id], orgs: [ha.id], cause: ev, text: `Article 4 is invoked: ${P(p)} attacked ${P(q)}, a fellow Hunter, without cause. The Association puts ${P(p)} on the blacklist.` })
        logRule(w, ha, 'no_hunter_on_hunter', p.id, 'blacklisted', e2)
      }
      // Troupe Rule 2: no serious fights between Spiders. Settled by a coin.
      for (const m of p.orgs) {
        const org = w.orgs[m.org]
        if (!inOrg(q, org.id)) continue
        if (org.key === 'troupe') {
          const killed = dead.includes(q) || dead.includes(p)
          if (killed) {
            const killer = dead.includes(q) ? p : q
            const e2 = leaveOrg(w, killer, org, 'expelled', ev, `The Phantom Troupe will not have a Spider who kills a Spider. ${P(killer)} is cast out.`)
            logRule(w, org, 'no_infighting', killer.id, 'expelled', e2)
          } else {
            const heads = r.chance(0.5)
            const e2 = log(w, { type: 'law', imp: 2, who: [p.id, q.id], orgs: [org.id], cause: ev, text: `${P(p)} and ${P(q)} come to blows. Rule 2: Spiders do not fight each other. A coin is tossed. ${heads ? P(p) : P(q)} wins the argument, and that is the end of it.` })
            logRule(w, org, 'no_infighting', p.id, 'coin toss', e2)
          }
        } else if (org.key === 'zoldyck' && dead.length) {
          const e2 = log(w, { type: 'law', imp: 3, who: [p.id, q.id], orgs: [org.id], cause: ev, text: `Family does not kill family. The Zoldycks will not forget what ${P(p)} did.` })
          logRule(w, org, 'family_bond', p.id, 'disgraced', e2)
          const mm = membership(p, org.id)
          if (mm) mm.loyalty -= 50
        }
      }
    }
  }
  // Robbing the auction, or killing a Mafia don, brings every family.
  if (o.why && /auction/.test(o.why)) {
    const mafia = orgK(w, 'mafia')
    for (const a of named) if (a.side === 0 && !inOrg(a.p!, mafia.id)) a.p!.flags.robbedMafia = 1
    logRule(w, mafia, 'auction_sacred', named[0]?.p?.id ?? -1, 'every family hunts the robbers', ev)
  }
  void members
}

/** Text of a rule, for the panel and for crossroads explanations. */
export function ruleText(w: World, org: Org, key: string): string {
  return org.rules.find((r) => r.key === key)?.text ?? key
}

export { O }
