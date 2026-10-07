/**
 * The Chairman election (Article 9). Every Hunter votes; rounds continue
 * until one candidate wins a majority of the votes cast. Hunters vote for
 * whoever they like and respect, and for whoever their friends are backing.
 * Some candidates want the chair. Some want to lose it on purpose.
 */
import { O, P, log } from '../history'
import type { Id, Org, Person, World } from '../types'
import { members, orgK, rng } from '../world'
import { power } from '../people/person'
import { remember } from '../people/memory'
import { startStory, endStory } from '../story/storyteller'

export function startElection(w: World, org: Org, cause?: Id) {
  if (org.flags.election) return
  org.flags.election = 1
  org.flags.electionRound = 0
  org.flags.electionNext = w.t + 21
  const ev = log(w, { type: 'faction', imp: 4, orgs: [org.id], cause, text: `The chair of the ${O(org)} is empty. By Article 9 the election begins at once. Every Hunter alive will vote.` })
  org.flags.electionEv = ev
  startStory(w, 'election', 'The Chairman Election', members(w, org.id).filter((m) => m.license && m.license.stars >= 1).slice(0, 6).map((m) => m.id), ev, 'election')
}

export function electionTick(w: World) {
  const org = orgK(w, 'ha')
  if (!org.flags.election || w.t < (org.flags.electionNext as number)) return
  const r = rng(w)
  const voters = members(w, org.id).filter((m) => m.license && !m.conds.some((c) => c.k === 'captive' || c.k === 'jailed'))
  if (!voters.length) { delete org.flags.election; return }
  const round = ((org.flags.electionRound as number) || 0) + 1
  org.flags.electionRound = round
  // Candidates: anyone a voter would name. Early rounds are wide open.
  const tally = new Map<Id, number>()
  for (const v of voters) {
    let best: Person | null = null, bs = -1e9
    for (const c of voters) {
      if (c === v && v.facets.pride < 75) continue
      const rel = v.rel[c.id]
      let s = c.fame * 0.6 + (c.license?.stars ?? 0) * 12 + power(c) * 0.15
      if (rel) s += rel.aff * 0.8 + rel.resp * 0.6 + rel.trust * 0.3
      if (c.dreams.some((d) => d.k === 'rule' && d.target === org.id)) s += 10
      if (c.dreams.some((d) => d.k === 'chaos')) s += 6
      s += r.next() * (round < 3 ? 40 : 15)
      if (s > bs) { bs = s; best = c }
    }
    if (best) tally.set(best.id, (tally.get(best.id) || 0) + 1)
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1])
  const total = voters.length
  const [topId, topV] = sorted[0]
  const top = w.people[topId]
  const pct = Math.round(topV / total * 100)
  const lines = sorted.slice(0, 4).map(([id, n]) => `${P(w.people[id])} ${Math.round(n / total * 100)}%`).join(', ')
  const cause = org.flags.electionEv as Id
  if (topV * 2 > total) {
    let winner = top
    delete org.flags.election
    const ev = log(w, { type: 'faction', imp: 4, who: [winner.id], orgs: [org.id], cause, text: `Round ${round} of the election: ${lines}. ${P(winner)} wins a majority and becomes Chairman of the Hunter Association.` })
    // A candidate who only ever wanted the game, not the prize.
    if (winner.dreams.some((d) => d.k === 'chaos') && !winner.dreams.some((d) => d.k === 'rule' && d.target === org.id && d.pri > 70) && r.chance(0.7)) {
      const next = sorted.find(([id]) => id !== winner.id)
      const heir = next ? w.people[next[0]] : null
      if (heir) {
        log(w, { type: 'faction', imp: 4, who: [winner.id, heir.id], orgs: [org.id], cause: ev, text: `${P(winner)} accepts the chair, appoints ${P(heir)} Vice-Chairman, and resigns on the spot. ${P(heir)} is Chairman.` })
        winner = heir
      }
    }
    org.leader = winner.id
    const mm = winner.orgs.find((m) => m.org === org.id)
    if (mm) { mm.rank = 3; mm.title = 'Chairman' }
    winner.role = 'chairman'
    winner.fame += 25
    remember(w, winner, { k: 'elected', val: 60, str: 70, ev, text: 'Became Chairman of the Hunter Association.' })
    endStory(w, 'election', ev, `${winner.name} became Chairman.`)
    return
  }
  log(w, { type: 'faction', imp: 3, orgs: [org.id], cause, who: sorted.slice(0, 4).map(([id]) => id), text: `Round ${round} of the Chairman election: ${lines}. Nobody has a majority. The vote goes on.` })
  org.flags.electionNext = w.t + 14
}
