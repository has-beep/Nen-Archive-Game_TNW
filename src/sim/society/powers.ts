/**
 * Things that keep a world moving after the story it started with has run
 * out: new criminal powers rising, coups in nations that are coming apart,
 * and creatures from beyond the lake washing up on its shores.
 */
import { L, N, O, P, log } from '../history'
import type { Nation, Org, Person, World } from '../types'
import { alive, at, members, orgK, rng, reindex } from '../world'
import { age, inOrg, power } from '../people/person'
import { joinOrg } from './orgs'
import { fight } from '../combat/aftermath'
import { kill } from '../events/death'
import { remember } from '../people/memory'
import { startStory, endStory } from '../story/storyteller'
import { addHazard, callForHelp } from './disasters'
import { spawn } from '../worldgen/spawn'
import { postContract } from './economy'

export function powersWeekly(w: World) {
  gangsRise(w)
  for (const o of w.orgs) if (o.kind === 'gang' && !o.dead && o.flags.risen) gangWeekly(w, o)
  for (const n of w.nations) nationTurmoil(w, n)
  washAshore(w)
}

/* ================= New criminal powers ================= */

const ADJ = ['Crimson', 'Ninefold', 'Hollow', 'Silent', 'Iron', 'Pale', 'Grinning', 'Seventh', 'Ashen', 'Glass', 'Black Tide', 'Bitter']
const NOUN = ['Lotus', 'Hounds', 'Lantern', 'Choir', 'Fang', 'Moths', 'Ledger', 'Masks', 'Wake', 'Thorn', 'Orchard', 'Saints']
const COLORS = ['#7f1d1d', '#4c1d95', '#1e3a8a', '#365314', '#78350f', '#0f766e', '#831843', '#3f3f46']

function gangsRise(w: World) {
  const r = rng(w)
  if (!r.chance(0.012)) return
  if (w.orgs.filter((o) => o.kind === 'gang' && !o.dead && o.flags.risen).length >= 3) return
  // A strong, cruel, ambitious Nen user with nobody to answer to.
  const cands = alive(w).filter((p) => p.species === 'human' && p.nen.lvl > 52 && !p.orgs.length && !p.owned && isFreeEnough(p) && p.facets.ambition > 60 && (p.facets.cruelty > 55 || p.facets.greed > 70) && p.facets.loyalty < 70 && age(w, p) >= 20)
  if (!cands.length) return
  const lead = cands.sort((a, b) => power(b) + b.facets.ambition - power(a) - a.facets.ambition)[0]
  const name = `${r.pick(ADJ)} ${r.pick(NOUN)}`
  const home = w.places[lead.loc]
  const org: Org = {
    id: w.orgs.length, key: `gang${w.orgs.length}`, name, short: name, kind: 'gang', leader: lead.id, hq: home.id, nation: home.nation,
    color: r.pick(COLORS), ranks: ['Member', 'Lieutenant', 'Boss'], treasury: 20, rep: 10, ops: [], tension: {}, founded: w.t, flags: { risen: 1 }, rulesLog: [],
    rules: gangRules(r.chance(0.5), lead), desc: `A gang that rose around ${lead.name} in ${home.name}.`,
  }
  w.orgs.push(org)
  reindex(w)
  joinOrg(w, lead, org, 2, { title: 'Boss', quiet: true, loyalty: 90 })
  const ev = log(w, { type: 'faction', imp: 4, who: [lead.id], at: home.id, orgs: [org.id], text: `${P(lead)} stops working alone. In ${L(home)}, people start talking about the ${O(org)}, and about who has gone missing since.` })
  startStory(w, 'gang', `The rise of the ${org.name}`, [lead.id], ev, `gang-${org.id}`)
  remember(w, lead, { k: 'gang', val: 40, str: 70, ev, text: `Founded the ${org.name}.` })
  recruit(w, org, 3 + r.int(4))
}

function isFreeEnough(p: Person) { return p.alive && !p.trip && !p.conds.some((c) => c.k === 'jailed' || c.k === 'kept' || c.k === 'captive') && !p.flags.onExp }

function gangRules(strict: boolean, lead: Person): Org['rules'] {
  const rules: Org['rules'] = [
    { key: 'split', n: '1', text: 'Every haul is split; the Boss takes the first share.' },
    { key: 'leave', n: '2', text: strict ? 'Nobody leaves alive.' : 'Anyone may leave once, and never come back.' },
  ]
  if (lead.facets.honesty > 50) rules.push({ key: 'word', n: '3', text: 'A deal made in the gang\'s name is kept.' })
  if (lead.facets.cruelty > 75) rules.push({ key: 'witness', n: rules.length + 1 + '', text: 'No witnesses.' })
  rules.push({ key: 'zoldyck', n: rules.length + 1 + '', text: 'Nobody touches the Zoldycks.' })
  return rules
}

function recruit(w: World, org: Org, n: number) {
  const r = rng(w)
  const lead = w.people[org.leader]
  if (!lead?.alive) return
  const pool = alive(w).filter((p) => p !== lead && p.species === 'human' && !p.orgs.length && !p.owned && !p.canon && isFreeEnough(p) && p.nen.lvl > 25 && p.facets.loyalty > 35 && (p.facets.cruelty > 45 || p.facets.greed > 60 || /criminal|thief|mercenary|drifter/.test(p.role)) && (p.loc === lead.loc || (lead.rel[p.id]?.aff ?? 0) > 20))
  r.shuffle(pool)
  let got = 0
  for (const p of pool) {
    if (got >= n) break
    if (!r.chance(0.5 + (lead.rel[p.id]?.aff ?? 0) / 200)) continue
    joinOrg(w, p, org, 0, { quiet: true, loyalty: 50 + r.int(40) })
    if (p.loc !== lead.loc) { p.plan = { k: 'go', place: lead.loc, until: w.t + 30, why: `Joining the ${org.name}` }; p.nextThink = w.t }
    got++
  }
  if (got) log(w, { type: 'faction', imp: 2, who: [lead.id], orgs: [org.id], text: `${got} more join the ${O(org)}.` })
}

function gangWeekly(w: World, org: Org) {
  const r = rng(w)
  const ms = members(w, org.id)
  const lead = w.people[org.leader]
  if (ms.length < 2 || !lead?.alive) {
    org.dead = true
    for (const m of ms) m.orgs = m.orgs.filter((x) => x.org !== org.id)
    reindex(w)
    const ev = log(w, { type: 'faction', imp: 3, orgs: [org.id], text: `The ${O(org)} is finished. ${lead && !lead.alive ? `Without ${P(lead)}, ` : ''}what is left of it scatters.` })
    endStory(w, `gang-${org.id}`, ev, 'It fell apart.')
    return
  }
  if (ms.length < 8 && r.chance(0.08)) recruit(w, org, 1 + r.int(2))
  // A job, now and then: somewhere with money and few people who can stop them.
  if (!org.ops.some((o) => o.k === 'raid') && r.chance(0.02 + lead.facets.greed / 3000) && ms.length >= 3) {
    const targets = w.places.filter((p) => p.wealth > 0.45 && p.kind !== 'beyond' && p.kind !== 'ship' && !p.features.includes('game') && p.key !== 'swardani')
    const tgt = r.pick(targets)
    if (!tgt) return
    const ev = log(w, { type: 'faction', imp: 3, who: [lead.id], orgs: [org.id], text: `${P(lead)} picks the ${O(org)}'s next job: ${L(tgt)}.` })
    org.ops.push({ k: 'raid', place: tgt.id, due: w.t + 20 + r.int(20), start: w.t, members: ms.map((m) => m.id), ev })
  }
  // The Association notices a gang that has made a name for itself.
  const ha = orgK(w, 'ha')
  if (r.chance(0.04)) for (const m of ms) if (m.infamy > 25 && m.bounty < 40) {
    m.bounty = 40 + m.infamy
    postContract(w, { k: 'bounty', client: -ha.id - 1, target: m.id, reward: m.bounty, why: `for running with the ${org.name}` })
  }
}

/* ================= Nations coming apart ================= */

function nationTurmoil(w: World, n: Nation) {
  const r = rng(w)
  if (n.gov === 'stateless' || n.key === 'free' || n.key === 'none') return
  const cap = w.places[n.capital]
  // A nation with nobody at its head gets someone, eventually.
  if (n.ruler < 0 && r.chance(0.12)) {
    const pool = alive(w).filter((p) => p.nation === n.id && /politician|officer|royal|prince|don|ruler/.test(p.role) && age(w, p) >= 25)
    const next = pool.sort((a, b) => b.facets.ambition + b.fame - a.facets.ambition - a.fame)[0] || (cap ? spawn(w, { role: 'politician', place: cap.id, age: [40, 65] }) : null)
    if (next) {
      n.ruler = next.id; next.role = 'ruler'; next.title = n.rulerTitle
      n.stability = Math.min(100, n.stability + 10)
      log(w, { type: 'politics', imp: 4, who: [next.id], nats: [n.id], text: `After months without a head, the ${N(n)} names ${P(next)} its ${n.rulerTitle}.` })
    }
    return
  }
  const ruler = w.people[n.ruler]
  if (!ruler?.alive || !cap) return
  // Riots when a country is falling apart.
  if (n.stability < 18 && r.chance(0.04)) {
    addHazard(w, cap, 'fire', 0.35)
    cap.unrest = Math.min(1, cap.unrest + 0.2)
    log(w, { type: 'politics', imp: 3, at: cap.id, nats: [n.id], text: `Riots in ${L(cap)}. Government buildings burn, and nobody in the ${N(n)} seems able to stop it.` })
  }
  // A coup.
  if (n.stability > 32 || !r.chance(0.018)) return
  const plotters = alive(w).filter((p) => p !== ruler && p.nation === n.id && /officer|politician|royal|prince/.test(p.role) && p.facets.ambition > 62 && p.facets.loyalty < 55 && !p.conds.length && age(w, p) >= 25)
  if (!plotters.length) return
  const p = plotters.sort((a, b) => b.facets.ambition + power(b) - a.facets.ambition - power(a))[0]
  const guards = at(w, ruler.loc).filter((q) => q !== ruler && q !== p && q.nation === n.id && /guard|soldier|officer/.test(q.role) && (q.rel[ruler.id]?.aff ?? 0) > (q.rel[p.id]?.aff ?? 0)).slice(0, 4)
  const allies = alive(w).filter((q) => q !== p && q.nation === n.id && /soldier|officer/.test(q.role) && (q.rel[p.id]?.aff ?? 0) > 20 && q.loc === ruler.loc).slice(0, 4)
  const ev = log(w, { type: 'politics', imp: 4, who: [p.id, ruler.id], at: ruler.loc, nats: [n.id], text: `${P(p)} moves against ${P(ruler)}. Soldiers loyal to ${P(p)} take the radio station in ${L(cap)} before dawn.` })
  startStory(w, 'coup', `Coup in the ${n.short}`, [p.id, ruler.id], ev, `coup-${n.id}-${w.t}`)
  if (p.loc !== ruler.loc) { p.loc = ruler.loc; p.trip = undefined }
  const out = fight(w, { a: [p, ...allies], b: [ruler, ...guards], intentA: 'kill', place: ruler.loc, why: 'in the coup', cause: ev, record: true,
    extrasA: [{ name: 'rebel soldier', str: 50, agi: 48, tou: 50, skill: 55, weapon: 'rifle', count: 6 + Math.round((100 - n.stability) / 10) }],
    extrasB: [{ name: 'palace guard', str: 52, agi: 48, tou: 52, skill: 58, weapon: 'rifle', count: 6 + Math.round(n.stability / 10) }] })
  if (out.res.winner === 0 && p.alive) {
    if (ruler.alive && !out.dead.includes(ruler)) { ruler.role = 'politician'; ruler.title = `Former ${n.rulerTitle}`; const away = w.places.find((x) => x.nation !== n.id && x.kind === 'city'); if (away) { ruler.loc = away.id; ruler.trip = undefined } }
    n.ruler = p.id; p.role = 'ruler'; p.title = n.rulerTitle
    n.stability = Math.max(10, n.stability - 5)
    const e2 = log(w, { type: 'politics', imp: 5, who: [p.id, ruler.id], nats: [n.id], cause: out.ev, text: `The coup succeeds. ${P(p)} is ${n.rulerTitle} of the ${N(n)}${ruler.alive ? `; ${P(ruler)} flees the country` : ''}.` })
    endStory(w, `coup-${n.id}-${w.t}`, e2, `${p.name} took power.`)
    for (const o of w.nations) if (o.rel[n.id]) o.rel[n.id].op -= 8
  } else if (p.alive) {
    const e2 = log(w, { type: 'politics', imp: 4, who: [p.id, ruler.id], nats: [n.id], cause: out.ev, text: `The coup fails. ${P(p)} is taken and shot.` })
    kill(w, p, { cause: 'executed for treason', ev: e2, quiet: true })
    n.stability = Math.min(100, n.stability + 6)
  }
}

/* ================= From beyond the lake ================= */

function washAshore(w: World) {
  const r = rng(w)
  if (!w.dc || w.laws.calamities === false) return
  const opened = (w.flags.expedition as { status?: string } | undefined)?.status === 'over' || w.dc.returned > 0
  if (!r.chance(opened ? 0.004 : 0.0015)) return
  const coast = w.places.filter((p) => (p.port || p.features.includes('coast') || p.kind === 'island') && p.kind !== 'ship' && p.kind !== 'beyond' && !p.features.includes('game'))
  const pl = r.pick(coast)
  const beasts = w.dc.calamities.filter((c) => c.mode === 'guardian' || c.mode === 'abduct')
  const c = r.chance(0.6) || !beasts.length ? null : r.pick(beasts)
  const kind = c?.mode === 'abduct' ? 'vanishing' : 'beast'
  const ev = log(w, { type: 'calamity', imp: 5, at: pl.id, text: c
    ? `Something comes out of the lake at ${L(pl)} that nobody inside it has a name for. People who know their history go pale: it looks like ${c.name}.`
    : `Something comes out of the lake at ${L(pl)} that nobody inside it has a name for. It has been in the water a long time, and it is hungry.` })
  addHazard(w, pl, kind, 0.8, { ev, cal: c?.key })
  const ha = orgK(w, 'ha')
  ha.treasury -= 200
  w.flags.beastBounty = { place: pl.id, cal: c?.key ?? 'unknown', reward: 600 }
  startStory(w, 'calamity', `The thing at ${pl.name}`, [], ev, `ashore-${w.t}`)
  // The Association asks its strongest to go.
  const hunters = members(w, ha.id).filter((h) => h.alive && h.nen.lvl > 65 && h.facets.bravery > 55 && !h.plan && !h.trip && !h.conds.length && !inOrg(h, orgK(w, 'zodiacs').id)).sort((a, b) => power(b) - power(a)).slice(0, 3)
  for (const h of hunters) { h.plan = { k: 'go', place: pl.id, until: w.t + 60, why: `Hunting the thing that came out of the lake at ${pl.name}`, ev }; h.nextThink = w.t }
  callForHelp(w, pl, ev, 0.6)
}
