/**
 * Expeditions beyond the lake.
 *
 * The Inviolability Treaty closes the Dark Continent. People go anyway: the
 * curious, the greedy, the desperate (someone they love is dying of
 * something only the Dark Continent can cure), and nations who want a hope
 * badly enough to break a treaty for it. A few go with permission.
 *
 * An expedition gathers at a port, crosses (past patrols, storms and the
 * Gatekeeper), walks inland week by week while the continent kills its
 * members, meets whatever guards the thing it came for, and turns for home
 * when it has it, or cannot go on. Most never come back. Some come back with
 * a treasure that changes a nation. Some come back carrying a calamity and
 * do not know it yet.
 */
import { CALAMITIES, DC_REGIONS, rollUnknowns, type CalamityDef, type HopeDef } from '../../data/darkcontinent'
import { L, N, P, log } from '../history'
import type { ExpeditionRun, Id, Item, Person, Place, World } from '../types'
import { alive, at, orgK, personK, placeK, rng, touch, members } from '../world'
import { age, hpMax, isAdult, isFree, power } from '../people/person'
import { remember } from '../people/memory'
import { change, hasBond, isKin } from '../people/relations'
import { addFact, learn, knows } from '../people/knowledge'
import { cureAll } from '../people/health'
import { kill } from '../events/death'
import { fight } from '../combat/aftermath'
import { makeItem } from './economy'
import { addHazard, clearHazard } from './disasters'
import { startStory, endStory } from '../story/storyteller'
import { offerCrossroad } from '../player/player'

/* ================= Setup ================= */

/** Rolls this world's Dark Continent and tells the few who would know. */
export function initDarkContinent(w: World) {
  const r = rng(w)
  const un = rollUnknowns((a) => r.pick(a), (n) => r.int(n))
  w.dc = {
    calamities: CALAMITIES.map((c) => JSON.parse(JSON.stringify(c)) as CalamityDef).concat(un.calamities),
    regions: DC_REGIONS.concat(un.regions),
    facts: {}, hopes: {}, attempts: 0, returned: 0,
  }
  w.expeditions = []
  const none = w.places.find((p) => p.key === 'dc_shore')!.nation
  for (const rg of w.dc.regions) {
    if (w.places.some((p) => p.key === rg.key)) continue
    w.places.push({
      id: w.places.length, key: rg.key, name: rg.name, nation: none, x: rg.x, y: rg.y, kind: 'beyond', pop: 0, danger: rg.danger, wealth: 0,
      airport: false, port: false, hospital: 0, features: ['dc', 'wild', 'calamity'], hazard: 0, hazardUntil: 0, unrest: 0, hidden: true, region: 'Outside Lake Mobius', desc: rg.desc,
    })
  }
  // The five recorded calamities are state secrets. The V5's leaders, the
  // Association's top people, and a few who went or studied them know.
  const knowers = new Set<Person>()
  for (const n of w.nations) if (n.blocs.includes('V5') && w.people[n.ruler]) knowers.add(w.people[n.ruler])
  for (const k of ['netero', 'beyond_netero', 'ging_freecss', 'pariston_hill', 'cheadle_yorkshire', 'botobai_gigante', 'mizaistom_nana', 'nasubi_hui_guo_rou']) { const p = personK(w, k); if (p) knowers.add(p) }
  for (const p of alive(w)) if ((p.role === 'scholar' || p.role === 'ruins') && p.skills.scholarship > 70) knowers.add(p)
  for (const c of w.dc.calamities) {
    if (!c.canon) continue
    const f = addFact(w, { k: 'secret', s: -1, d: `calamity:${c.key}`, secret: 0.85, imp: 4, text: `${c.name}, ${c.title}. ${c.desc} Its hope: ${c.hope.name}.` })
    w.dc.facts[c.key] = f.id
    for (const p of knowers) learn(w, p, f)
  }
}

const runs = (w: World): ExpeditionRun[] => (w.expeditions ||= [])
const ACTIVE = new Set(['gathering', 'crossing', 'exploring', 'returning'])
export function activeRuns(w: World): ExpeditionRun[] { return runs(w).filter((x) => ACTIVE.has(x.stage)) }
function cal(w: World, key: string): CalamityDef | undefined { return w.dc?.calamities.find((c) => c.key === key) }
function calOfRegion(w: World, region: string): CalamityDef | undefined { return w.dc?.calamities.find((c) => c.region === region) }
function regionName(w: World, key: string) { return w.dc?.regions.find((r) => r.key === key)?.name ?? 'the Dark Continent' }
function crew(w: World, x: ExpeditionRun): Person[] { return x.members.map((id) => w.people[id]).filter((p) => p && p.alive && p.flags.onExp === x.id) }

/* ================= The daily hook ================= */

export function expeditionsDaily(w: World) {
  if (!w.dc || w.laws.expeditions === false) return
  if (w.t % 7 === 3) organizeWeekly(w)
  for (const x of runs(w)) if (ACTIVE.has(x.stage) && w.t >= x.next) step(w, x)
  if (w.t % 7 === 5) { hopesWeekly(w); castawaysWeekly(w) }
  leaksDaily(w)
}

/* ================= Who goes ================= */

function organizeWeekly(w: World) {
  const r = rng(w)
  if (activeRuns(w).length >= 3) return
  const kakin = w.flags.expedition as { status?: string } | undefined
  const rush = kakin && kakin.status !== 'announced' ? 0.012 : 0
  const fame = Object.values(w.dc!.hopes).reduce((s, n) => s + n, 0) * 0.006
  // A nation that wants a hope enough to break the treaty.
  if (r.chance(0.0025 + rush * 0.3)) {
    const n = r.pick(w.nations.filter((n) => n.traits.expansion > 65 && n.traits.ruthless > 50 && n.treasury > 200 && !n.blocs.includes('V5') && !n.blocs.includes('V6')) || [])
    if (n) { nationExpedition(w, n); return }
  }
  if (!r.chance(0.011 + rush + fame)) return
  // A person with a reason.
  let best: { p: Person; why: string; goal?: string; s: number } | null = null
  for (const p of alive(w)) {
    if (p.species !== 'human' || !isAdult(w, p) || !isFree(p) || p.flags.onExp != null || p.flags.castaway || p.flags.homebound || age(w, p) > 72 || /prince|royal|ruler|child|butler|chairman/.test(p.role)) continue
    if (p.nen.lvl < 35 && !(['ruins', 'treasure', 'beast', 'sea'].includes(p.role) && p.nen.lvl >= 25)) continue
    let s = 0, why = '', goal: string | undefined
    const ex = p.dreams.find((d) => d.k === 'explore' && !d.done)
    if (ex) { s = ex.pri; why = 'to see what is out there' }
    const dis = p.dreams.find((d) => d.k === 'discover' && !d.done)
    if (dis && p.facets.curiosity > 70 && dis.pri * 0.6 > s) { s = dis.pri * 0.6; why = 'because nobody has ever recorded what lives there' }
    const wl = p.dreams.find((d) => d.k === 'wealth' && !d.done)
    if (wl && p.facets.greed > 75 && wl.pri * 0.5 > s) { s = wl.pri * 0.5; why = 'for a hope worth more than a nation'; goal = richestKnown(w, p) }
    // Someone they love is dying of something nothing inside the lake cures.
    const sick = lovedSick(w, p)
    if (sick && knowsCure(w, p) && 95 > s) { s = 95; why = `for the Herb for All Illnesses, for ${sick.name}`; goal = 'dc_ruins' }
    s *= (0.5 + p.facets.bravery / 200) * (0.6 + r.next() * 0.8)
    if (s > 30 && (!best || s > best.s)) best = { p, why, goal, s }
  }
  if (best) personalExpedition(w, best.p, best.why, best.goal)
}

function lovedSick(w: World, p: Person): Person | null {
  for (const id in p.rel) {
    const q = w.people[+id]
    if (!q?.alive || !(p.rel[id].aff > 65 || isKin(p, q.id) && p.rel[id].aff > 30)) continue
    if (q.conds.some((c) => c.k === 'zobae' || c.k === 'radiation' || c.k === 'undying' || c.k === 'contaminated')) return q
  }
  return null
}
function knowsCure(w: World, p: Person): boolean {
  const f = w.dc!.facts.brion
  return f != null && (p.know[f] != null || p.license != null && p.skills.scholarship > 50)
}
function richestKnown(w: World, p: Person): string | undefined {
  const known = w.dc!.calamities.filter((c) => w.dc!.facts[c.key] != null && p.know[w.dc!.facts[c.key]] != null)
  return known.sort((a, b) => b.hope.value - a.hope.value)[0]?.region
}

function nearestPort(w: World, from: Place, legal: boolean): Place {
  const ports = w.places.filter((q) => (q.port || q.features.includes('harbor')) && q.kind !== 'beyond' && q.kind !== 'ship' && q.hazard < 0.3 && (legal || q.key !== 'swardani'))
  return ports.sort((a, b) => ((a.x - from.x) ** 2 + (a.y - from.y) ** 2) - ((b.x - from.x) ** 2 + (b.y - from.y) ** 2))[0] || placeK(w, 'dolle')
}

function newRun(w: World, o: { name: string; leader: Person; legal: boolean; goal?: string; sponsor?: ExpeditionRun['sponsor']; port: Place }): ExpeditionRun {
  const x: ExpeditionRun = {
    id: runs(w).length + 1, name: o.name, leader: o.leader.id, members: [o.leader.id], sponsor: o.sponsor, legal: o.legal, port: o.port.id,
    stage: 'gathering', t0: w.t, next: w.t + 21 + rng(w).int(14), goal: o.goal, weeks: 0, supplies: 1, morale: 70, found: [], met: [], carried: [], dead: [], ev: -1,
  }
  runs(w).push(x)
  return x
}

function enlist(w: World, x: ExpeditionRun, p: Person) {
  if (!x.members.includes(p.id)) x.members.push(p.id)
  p.flags.onExp = x.id
  p.flags.expedition = 1
  p.plan = { k: 'go', place: x.port, until: x.next + 3, why: `Meeting the ${x.name} at ${w.places[x.port].name}` }
  p.nextThink = w.t
}

/** Friends, students and hired hands who will follow a leader off the edge of the world. */
function recruit(w: World, x: ExpeditionRun, leader: Person, max: number) {
  const r = rng(w)
  const cands: { q: Person; s: number }[] = []
  for (const id in leader.rel) {
    const q = w.people[+id]
    const rel = leader.rel[id]
    const back = q?.rel[leader.id]
    if (!q || !q.alive || q.species !== 'human' || !isAdult(w, q) || !isFree(q) || q.flags.onExp != null || q.flags.homebound || age(w, q) > 72 || /prince|royal|ruler|child|butler|chairman/.test(q.role)) continue
    if (q.nen.lvl < 25 || q.facets.bravery < 45 || (back?.aff ?? 0) < 30) continue
    const s = (back?.aff ?? 0) + (back?.trust ?? 0) / 2 + (hasBond(rel, 'student') || hasBond(rel, 'comrade') ? 30 : 0) + q.facets.curiosity / 4 + q.facets.bravery / 4
    cands.push({ q, s: s * (0.7 + r.next() * 0.6) })
  }
  cands.sort((a, b) => b.s - a.s)
  for (const { q } of cands) {
    if (x.members.length >= max) break
    if (q.owned) { inviteOwned(w, x, q, leader); continue }
    if (!r.chance(0.35 + q.facets.curiosity / 300 + q.facets.loyalty / 400)) continue
    enlist(w, x, q)
  }
  // Money buys the rest: mercenaries and Hunters who will go anywhere for enough.
  const purse = x.sponsor?.nation != null ? w.nations[x.sponsor.nation].treasury : leader.jenny
  if (x.members.length < max && purse > 60) {
    const hire = alive(w).filter((q) => q.species === 'human' && isFree(q) && isAdult(w, q) && q.flags.onExp == null && !q.owned && !q.major && (q.role === 'mercenary' || q.license && q.facets.greed > 60) && q.nen.lvl > 35 && q.facets.bravery > 50)
    r.shuffle(hire)
    for (const q of hire.slice(0, max - x.members.length)) {
      const fee = 40 + q.nen.lvl
      if (x.sponsor?.nation != null) w.nations[x.sponsor.nation].treasury -= fee
      else leader.jenny -= fee
      q.jenny += fee
      enlist(w, x, q)
    }
  }
}

function inviteOwned(w: World, x: ExpeditionRun, q: Person, leader: Person) {
  offerCrossroad(w, q, {
    title: 'Beyond the lake',
    prompt: `${leader.name} is going to the Dark Continent${x.legal ? '' : ', against the treaty'}, and wants ${q.short} along.`,
    options: [
      { k: 'exp_join', label: 'Go', desc: 'Most who go never come back. Some come back with something worth a nation.', fit: Math.min(1, 0.3 + q.facets.curiosity / 200 + q.facets.bravery / 300) },
      { k: 'exp_decline', label: 'Stay', desc: 'Let them go without you.', fit: Math.min(1, 0.4 + q.facets.discipline / 300) },
    ],
    ctx: { run: x.id },
    days: 10,
  })
}

/** Player choices about expeditions. */
export function resolveExpeditionChoice(w: World, p: Person, k: string, ctx: Record<string, number>) {
  const x = runs(w).find((e) => e.id === ctx.run)
  if (!x) return
  if (k === 'exp_join' && x.stage === 'gathering') enlist(w, x, p)
  if (k === 'exp_push' && x.stage === 'exploring') { x.morale = Math.min(100, x.morale + 15); x.flags = { ...(x.flags || {}), pushed: w.t } }
  if (k === 'exp_return' && x.stage === 'exploring') turnHome(w, x, x.found.length ? null : 'turned back halfway')
}

function personalExpedition(w: World, leader: Person, why: string, goal?: string) {
  const r = rng(w)
  // With the Association's blessing, if the Chairman himself is going, or
  // the V6 have opened the way.
  const ha = orgK(w, 'ha')
  const kakin = w.flags.expedition as { v6?: boolean; status?: string } | undefined
  const legal = (ha.leader === leader.id || kakin?.v6 && leader.license && (leader.license.stars >= 2 || members(w, orgK(w, 'zodiacs').id).includes(leader))) === true && r.chance(0.7)
  const port = nearestPort(w, w.places[leader.loc], legal)
  const x = newRun(w, { name: `${leader.short}'s expedition`, leader, legal, goal, port })
  enlist(w, x, leader)
  recruit(w, x, leader, 3 + r.int(5))
  const ev = log(w, {
    type: 'expedition', imp: leader.major || leader.owned ? 4 : 3, who: x.members, at: leader.loc,
    text: legal
      ? `${P(leader)} is going to the Dark Continent ${why}, with the Association's blessing. ${x.members.length > 1 ? `${x.members.length - 1} go with them.` : 'They go alone.'}`
      : `${P(leader)} quietly starts putting together an expedition to the Dark Continent, ${why}. It breaks a treaty two hundred years old. ${x.members.length > 1 ? `${x.members.length - 1} agree to go.` : 'Nobody else will go.'}`,
  })
  x.ev = ev
  startStory(w, 'expedition', x.name, x.members.slice(), ev, `exp-${x.id}`)
  const plan = addFact(w, { k: 'plan', s: leader.id, d: `exp:${x.id}`, secret: legal ? 0 : 0.85, imp: 3, text: `${leader.name} is planning an expedition to the Dark Continent from ${port.name}.`, ev })
  for (const id of x.members) learn(w, w.people[id], plan)
}

function nationExpedition(w: World, n: import('../types').Nation) {
  const r = rng(w)
  const pool = alive(w).filter((p) => p.species === 'human' && isAdult(w, p) && isFree(p) && p.flags.onExp == null && !p.owned && w.places[p.loc].nation === n.id && (p.role === 'officer' || p.role === 'soldier' || p.role === 'mercenary') && p.nen.lvl > 30)
  if (pool.length < 2) return
  const leader = pool.sort((a, b) => power(b) - power(a))[0]
  const port = nearestPort(w, w.places[n.capital >= 0 ? n.capital : leader.loc], false)
  const goal = r.pick(w.dc!.calamities.filter((c) => c.canon && (c.hope.use === 'energy' || c.hope.use === 'alchemy' || c.hope.use === 'longevity'))).region
  const x = newRun(w, { name: `the ${n.short} expedition`, leader, legal: false, goal, port, sponsor: { nation: n.id } })
  enlist(w, x, leader)
  for (const q of pool.filter((q) => q !== leader).slice(0, 3 + r.int(4))) enlist(w, x, q)
  recruit(w, x, leader, x.members.length + 2)
  n.treasury -= 150
  const ev = log(w, { type: 'expedition', imp: 4, who: x.members, nats: [n.id], text: `The ${N(n)} secretly fits out an expedition to the Dark Continent under ${P(leader)}: soldiers, hired Hunters, and orders to bring back a hope. If the V5 find out, it is war.` })
  x.ev = ev
  startStory(w, 'expedition', x.name, x.members.slice(), ev, `exp-${x.id}`)
  addFact(w, { k: 'plan', s: leader.id, d: `exp:${x.id}`, secret: 0.9, imp: 4, text: `The ${n.name} is sending an illegal expedition to the Dark Continent.`, ev })
}

/** The Black Whale's arrival turns into an expedition on land: Beyond and
 *  whoever came to explore go inland; the Association's people go to watch him. */
export function kakinLanding(w: World, ev: Id): ExpeditionRun | null {
  const ship = placeK(w, 'blackwhale')
  const beyond = personK(w, 'beyond_netero')
  const ashore = at(w, ship.id).filter((p) => p.species === 'human' && isAdult(w, p) && !/prince|royal|ruler|child|butler/.test(p.role) && (p.dreams.some((d) => d.k === 'explore') || p.key === 'beyond_netero' || p.orgs.some((m) => w.orgs[m.org].key === 'zodiacs')))
  const leader = beyond?.alive && ashore.includes(beyond) ? beyond : ashore.sort((a, b) => power(b) - power(a))[0]
  if (!leader) return null
  const x = newRun(w, { name: `${leader.short}'s landing party`, leader, legal: true, port: ship, sponsor: { nation: w.nations.find((n) => n.key === 'kakin')!.id } })
  x.goal = leader.key === 'beyond_netero' ? 'dc_southshore' : undefined
  for (const p of ashore) { if (!x.members.includes(p.id)) x.members.push(p.id); p.flags.onExp = x.id; p.flags.expedition = 1 }
  x.ev = ev
  // They are already across: go straight to the shore.
  const shore = placeK(w, 'dc_shore')
  for (const p of crew(w, x)) { p.trip = undefined; p.loc = shore.id; p.plan = null; touch(w, p) }
  x.stage = 'exploring'
  x.region = 'dc_shore'
  x.walk = x.goal ? w.dc!.regions.find((r) => r.key === x.goal)?.depth ?? 4 : 3
  x.next = w.t + 7
  startStory(w, 'expedition', x.name, x.members.slice(), ev, `exp-${x.id}`)
  return x
}

/* ================= Stages ================= */

function step(w: World, x: ExpeditionRun) {
  switch (x.stage) {
    case 'gathering': return sail(w, x)
    case 'crossing': return crossing(w, x)
    case 'exploring': return explore(w, x)
    case 'returning': return comeHome(w, x)
  }
}

function end(w: World, x: ExpeditionRun, stage: ExpeditionRun['stage'], text: string, imp: number) {
  x.stage = stage
  x.end = text
  x.endT = w.t
  const ev = log(w, { type: 'expedition', imp, who: x.members.slice(0, 12), cause: x.ev, text })
  endStory(w, `exp-${x.id}`, ev, text)
  for (const p of crew(w, x)) { delete p.flags.onExp; delete p.flags.expedition }
  return ev
}

function sail(w: World, x: ExpeditionRun) {
  const r = rng(w)
  const port = w.places[x.port]
  const leader = w.people[x.leader]
  const here = crew(w, x).filter((p) => p.loc === port.id && !p.trip)
  for (const p of crew(w, x)) if (!here.includes(p)) { delete p.flags.onExp; delete p.flags.expedition }
  x.members = here.map((p) => p.id)
  if (!leader?.alive || !here.includes(leader) || here.length < 1) {
    end(w, x, 'turned_back', `${x.name} never sails. ${leader?.alive ? `${P(leader)} could not get the people or the ship together.` : 'Its leader is gone.'}`, 2)
    return
  }
  const shore = placeK(w, 'dc_shore')
  const days = 40 + r.int(35)
  for (const p of here) { p.trip = { from: port.id, to: shore.id, t0: w.t, t1: w.t + days, mode: 'sea' }; p.loc = shore.id; p.plan = null; touch(w, p) }
  x.stage = 'crossing'
  x.arrive = w.t + days
  x.next = w.t + Math.floor(days / 2)
  if (!x.legal) w.dc!.attempts++
  log(w, {
    type: 'expedition', imp: here.some((p) => p.major || p.owned) ? 4 : 3, who: x.members, at: port.id, cause: x.ev,
    text: x.legal
      ? `${x.name} sails from ${L(port)}: ${here.map((p) => P(p)).join(', ')}. The lake is wide. Past it, nobody can help them.`
      : `${x.name} slips out of ${L(port)} before dawn with no lights: ${here.map((p) => P(p)).join(', ')}. The V5's patrol boats are somewhere out there.`,
  })
}

function crossing(w: World, x: ExpeditionRun) {
  const r = rng(w)
  const people = crew(w, x)
  const leader = w.people[x.leader]
  if (!x.halfway) {
    x.halfway = true
    x.next = x.arrive!
    // The lake is not kind to small ships.
    if (r.chance(0.045)) {
      for (const p of people) kill(w, p, { cause: 'lost at sea on the way to the Dark Continent', quiet: !p.major && !p.owned, how: `${P(p)} is lost with the ship.` })
      end(w, x, 'lost', `${x.name} is never seen again. Somewhere on Lake Mobius a ship went down, or did not, and nobody will ever know which.`, 4)
      return
    }
    // The V5 watch the lake. A plan that has leaked makes it easy.
    if (!x.legal) {
      const leaked = alive(w).some((p) => p.know[findPlan(w, x)] != null && (p.orgs.some((m) => ['ha', 'v5'].includes(w.orgs[m.org].key)) || /ruler|politician|officer/.test(p.role)) && !x.members.includes(p.id))
      const pc = 0.28 + (leaked ? 0.25 : 0) - (leader?.skills.stealth ?? 0) / 500 - (leader?.skills.strategy ?? 0) / 600 + (w.flags.expedition ? -0.08 : 0)
      if (r.chance(Math.max(0.05, pc))) { caught(w, x, people, 'on the way out'); return }
    }
    // The Gatekeeper of the New World does not like bad manners.
    if (leader?.alive && r.chance(x.legal ? 0.12 : 0.22)) {
      const rude = leader.facets.honesty < 30 || leader.facets.cruelty > 65 || leader.facets.pride > 82
      if (rude && r.chance(0.6)) {
        const lost = people.filter((p) => p !== leader).slice(0, 1 + r.int(2))
        for (const p of lost) kill(w, p, { cause: 'the Gatekeeper of the New World', quiet: !p.major, how: `${P(p)} is taken by the Gatekeeper of the New World.` })
        for (const p of crew(w, x)) { const port = w.places[x.port]; p.trip = { from: p.loc, to: port.id, t0: w.t, t1: w.t + 20, mode: 'sea' }; p.loc = port.id; touch(w, p) }
        end(w, x, 'turned_back', `At the edge of the lake, something vast rises out of the water and looks at ${P(leader)}. The Gatekeeper of the New World does not like what it sees. ${x.name} turns back with ${lost.length ? `${lost.length} fewer` : 'everyone, somehow'}.`, 4)
        return
      }
      log(w, { type: 'expedition', imp: 3, who: x.members, cause: x.ev, text: `At the edge of the lake, ${x.name} meets the Gatekeeper of the New World. ${P(leader)} is polite, and it lets them pass.` })
    }
    return
  }
  // Landfall.
  x.stage = 'exploring'
  x.region = 'dc_shore'
  x.walk = x.goal ? w.dc!.regions.find((g) => g.key === x.goal)?.depth ?? 4 : 2 + r.int(4)
  x.next = w.t + 7
  log(w, { type: 'expedition', imp: crew(w, x).some((p) => p.major || p.owned) ? 4 : 3, who: x.members, at: placeK(w, 'dc_shore').id, cause: x.ev, text: `${x.name} lands on the Dark Continent. ${crew(w, x).length} step ashore.${x.goal ? ` They head for ${regionName(w, x.goal)}.` : ' They have no map. Nobody does.'}` })
}

function findPlan(w: World, x: ExpeditionRun): number {
  for (let i = w.facts.length - 1; i >= 0; i--) if (w.facts[i].k === 'plan' && w.facts[i].d === `exp:${x.id}`) return w.facts[i].id
  return -1
}

/** Caught by the V5: the Association's cells, a scandal, and any hope
 *  aboard taken "into safekeeping". */
function caught(w: World, x: ExpeditionRun, people: Person[], when: string) {
  const sw = placeK(w, 'swardani')
  const v5 = w.nations.filter((n) => n.blocs.includes('V5') || n.blocs.includes('V6')).sort((a, b) => b.mil.navy - a.mil.navy)[0]
  for (const p of people) {
    p.trip = undefined; p.loc = sw.id; touch(w, p)
    p.conds.push({ k: 'jailed', until: w.t + 150 + rng(w).int(200), note: 'held for breaking the Inviolability Treaty' })
    p.infamy += 15
    p.fame += 5
    remember(w, p, { k: 'jailed', val: -40, str: 60, text: 'Caught by the V5 trying to reach the Dark Continent.' })
  }
  const seized = x.found.map((k) => w.dc!.calamities.find((c) => c.hope.key === k)?.hope).filter(Boolean) as HopeDef[]
  x.found = []
  for (const h of seized) if (v5) bringHope(w, h, null, v5.id)
  if (x.sponsor?.nation != null && v5) {
    const n = w.nations[x.sponsor.nation]
    const r1 = v5.rel[n.id]; if (r1) r1.op -= 40
  }
  end(w, x, 'caught', `The V5's patrol boats catch ${x.name} ${when}. ${people.map((p) => P(p)).join(', ')} are taken to the Association's cells in ${L(sw)}.${seized.length ? ` What they brought back, ${seized.map((h) => h.name).join(' and ')}, is taken by the ${v5 ? N(v5) : 'V5'}.` : ''}`, 4)
}

/* ---------------- On the continent ---------------- */

const DC_DEATHS = [
  'something in the trees took {p} without a sound',
  '{p} drank from a stream that looked clean',
  'a beast nobody inside the lake has a name for killed {p}',
  '{p} was stung by an insect the size of a hand and was dead by morning',
  '{p} went to scout ahead and did not come back',
  'a fever with no name took {p} in three days',
  'the ground opened under {p}',
  '{p} touched a flower',
]

function explore(w: World, x: ExpeditionRun) {
  const r = rng(w)
  x.next = w.t + 7
  x.weeks++
  let people = crew(w, x)
  const leader = w.people[x.leader]
  if (!people.length) { lostForever(w, x); return }
  // The leader died: the strongest of the rest takes over, or they turn back.
  if (!leader?.alive || !people.includes(leader)) {
    const nl = people.sort((a, b) => power(b) - power(a))[0]
    x.leader = nl.id
    x.morale -= 15
    log(w, { type: 'expedition', imp: 3, who: [nl.id], cause: x.ev, text: `With its leader gone, ${P(nl)} takes charge of what is left of ${x.name}.` })
  }
  const region = w.dc!.regions.find((g) => g.key === x.region) || { danger: 0.9 }
  x.supplies = Math.max(0, x.supplies - 0.045 - people.length * 0.004)
  // The continent itself.
  for (const p of people) {
    const pw = power(p)
    const pd = region.danger * 0.055 * Math.max(0.3, 1.4 - pw / 180) * (x.supplies < 0.2 ? 2.2 : 1) * (w.laws.lethality / 0.5)
    if (r.chance(pd)) {
      x.dead.push(p.id)
      x.morale -= 8
      kill(w, p, { cause: 'the Dark Continent', quiet: !p.major && !p.owned, how: capital(r.pick(DC_DEATHS).replace('{p}', P(p))) + '.' })
    } else if (r.chance(0.06)) {
      p.hp = Math.max(1, p.hp - hpMax(p) * 0.3)
    }
  }
  people = crew(w, x)
  if (!people.length) { lostForever(w, x); return }
  x.morale = Math.max(0, Math.min(100, x.morale - 2 + (people.some((p) => p.skills.leadership > 70) ? 2 : 0)))
  // Walking.
  if ((x.walk ?? 0) > 0) {
    x.walk = (x.walk ?? 0) - 1
    // Or stumbling somewhere no map shows.
    if (r.chance(x.goal ? 0.04 : 0.12)) {
      const unknown = w.dc!.regions.filter((g) => g.key.startsWith('dc_u') && !x.met.includes(calOfRegion(w, g.key)?.key ?? ''))
      if (unknown.length) {
        const g = r.pick(unknown)
        x.goal = g.key
        x.walk = 1 + r.int(3)
        log(w, { type: 'expedition', imp: 4, who: people.map((p) => p.id), cause: x.ev, text: `${x.name} walks into a place no map inside the lake has ever shown: ${g.name}.` })
      }
    }
    if ((x.walk ?? 0) <= 0) arriveRegion(w, x)
  } else if (x.goal && x.region !== x.goal) {
    arriveRegion(w, x)
  } else if (x.region && x.region !== 'dc_shore') {
    // At the goal: meet what lives here, then look for what it guards.
    // At the goal: what lives here finds them, sooner or later, and keeps
    // finding them. The thing it guards is not lying in the open.
    const c = calOfRegion(w, x.region)
    if (c && r.chance(x.met.includes(c.key) ? 0.22 : 0.6)) meet(w, x, c)
    people = crew(w, x)
    if (c && people.length && !x.found.includes(c.hope.key)) {
      const lead = w.people[x.leader]
      const pf = 0.09 * (0.5 + ((lead?.mind.int ?? 50) + (lead?.skills.strategy ?? 50) + (lead?.skills.tracking ?? 50)) / 300) * (x.met.includes(c.key) ? 1.2 : 0.5)
      if (r.chance(pf)) {
        x.found.push(c.hope.key)
        x.morale = Math.min(100, x.morale + 30)
        log(w, { type: 'expedition', imp: 5, who: people.map((p) => p.id), cause: x.ev, text: `In ${regionName(w, c.region)}, ${x.name} finds what it came for: ${c.hope.name}. ${c.hope.desc}` })
      }
    }
  } else if (!x.goal) {
    // No goal: pick somewhere.
    const g = r.pick(w.dc!.regions)
    x.goal = g.key
    x.walk = g.depth
  }
  people = crew(w, x)
  if (!people.length) { lostForever(w, x); return }
  // Turning for home.
  const owned = people.find((p) => p.owned)
  const shaky = x.supplies < 0.4 || x.morale < 40
  if (owned && shaky && !x.found.length && !(x.flags as { asked?: number } | undefined)?.asked) {
    x.flags = { ...(x.flags || {}), asked: w.t }
    offerCrossroad(w, owned, {
      title: 'Go on, or go home',
      prompt: `${x.name} is ${x.weeks} weeks into the Dark Continent. Supplies are ${Math.round(x.supplies * 100)}% and morale is ${x.morale < 30 ? 'breaking' : 'low'}. ${x.dead.length} are dead.`,
      options: [
        { k: 'exp_push', label: 'Push on', desc: 'They have come this far.', fit: Math.min(1, 0.3 + owned.facets.bravery / 200 + owned.facets.ambition / 300) },
        { k: 'exp_return', label: 'Turn back', desc: 'Go home with whoever is still alive.', fit: Math.min(1, 0.3 + owned.facets.empathy / 250 + (100 - owned.facets.bravery) / 300) },
      ],
      ctx: { run: x.id }, days: 7,
    })
    return
  }
  if (x.found.length) turnHome(w, x, null)
  else if (x.supplies < 0.18 || x.morale < 15 || x.weeks > 32) turnHome(w, x, 'turned back halfway')
}

function arriveRegion(w: World, x: ExpeditionRun) {
  if (!x.goal) return
  const pl = placeK(w, x.goal)
  if (!pl) return
  x.region = x.goal
  for (const p of crew(w, x)) { p.loc = pl.id; touch(w, p) }
  const c = calOfRegion(w, x.goal)
  log(w, { type: 'expedition', imp: 3, who: x.members, at: pl.id, cause: x.ev, text: `${x.name} reaches ${L(pl)}. ${c && w.dc!.facts[c.key] != null && crew(w, x).some((p) => p.know[w.dc!.facts[c.key]] != null) ? `They know what lives here. They came anyway.` : 'Nobody among them knows what lives here.'}` })
}

/** Meeting a calamity. Each one is its own kind of terrible. */
function meet(w: World, x: ExpeditionRun, c: CalamityDef) {
  const r = rng(w)
  const people = crew(w, x)
  const again = x.met.includes(c.key)
  if (!again) x.met.push(c.key)
  const pl = placeK(w, c.region)
  const party = people.reduce((s, p) => s + power(p), 0)
  const T = 280 * c.power
  const first = w.dc!.facts[c.key] == null
  let text = ''
  const died: Person[] = []
  const die = (p: Person, how: string) => { died.push(p); x.dead.push(p.id); kill(w, p, { cause: `${c.name} on the Dark Continent`, quiet: true, how: how.replace('{p}', P(p)) }) }
  switch (c.mode) {
    case 'guardian': {
      const winP = party / (party + T * 1.6)
      for (const p of people) if (r.chance(c.power * 0.55 * (1 - party / (party + T)) * (power(p) < 100 ? 1.3 : 0.8))) die(p, `${c.name} kills {p}.`)
      if (r.chance(winP) && crew(w, x).length) {
        text = `${c.name} comes for ${x.name}. They fight it, and somehow they are still standing when it withdraws.`
        x.found.push(c.hope.key)
        for (const p of crew(w, x)) p.fame += 25
      } else text = `${c.name} comes for ${x.name}. It is not a fight. It is a harvest.`
      if (crew(w, x).length && r.chance(0.15)) x.carried.push(c.key)
      break
    }
    case 'abduct': {
      for (const p of people) {
        if (!r.chance(0.35 * c.power * Math.max(0.3, 1 - power(p) / 250))) continue
        died.push(p)
        p.flags.castaway = c.region
        p.flags.castawayT = w.t
        p.flags.keptBy = c.key
        delete p.flags.onExp
        p.conds.push({ k: 'kept', until: -1, note: c.name })
        remember(w, p, { k: 'kept', val: -80, str: 95, text: `Taken by ${c.name}.` })
      }
      text = `${c.name} finds ${x.name}. ${died.length ? `It takes ${died.map((p) => P(p)).join(', ')}, alive, and carries them off to keep.` : 'It watches them for days and takes no one. Nobody sleeps.'}`
      if (r.chance(0.12)) x.carried.push(c.key)
      break
    }
    case 'frenzy': {
      const bitten = people.filter(() => r.chance(0.55 * c.power))
      for (const p of bitten) p.conds.push({ k: 'frenzied', until: w.t + 4, note: c.name })
      text = `${c.name} moves through the camp at night. ${bitten.length} are bitten. By morning they have turned on everyone else.`
      for (const a of bitten) {
        const b = r.pick(crew(w, x).filter((q) => q !== a && q.alive))
        if (!a.alive || !b) continue
        const out = fight(w, { a: [a], b: [b], intentA: 'kill', intentB: 'defend', place: pl.id, why: `in the madness of ${c.name}'s bite`, record: a.major || b.major || a.owned || b.owned })
        for (const d of out.dead) { died.push(d); x.dead.push(d.id) }
      }
      if (crew(w, x).some((p) => p.conds.some((cc) => cc.k === 'frenzied')) || r.chance(0.3)) x.carried.push(c.key)
      break
    }
    case 'gas': {
      for (const p of people) {
        if (!r.chance(0.3)) continue
        p.nen.lvl = Math.min(p.nen.cap + 5, p.nen.lvl + 6)
        p.jenny += 200
        const others = crew(w, x).filter((q) => q !== p)
        if (others.length && r.chance(0.7)) die(r.pick(others), `The haze takes its payment: {p} is found twisted like wrung cloth.`)
      }
      text = `${x.name} walks into ${c.name}. It asks them what they want. Some of them answer.`
      const host = crew(w, x).find(() => r.chance(0.2))
      if (host) { host.conds.push({ k: 'wish', until: -1, note: c.name }); x.carried.push(c.key) }
      break
    }
    case 'plague': {
      for (const p of people) if (!p.conds.some((cc) => cc.k === 'zobae' || cc.k === 'undying') && r.chance(0.6 * c.power)) p.conds.push({ k: 'zobae', until: w.t + 200, p: 1, note: c.key })
      const sick = crew(w, x).filter((p) => p.conds.some((cc) => cc.k === 'zobae'))
      text = `${sick.length ? `${sick.map((p) => P(p)).join(', ')} ${sick.length > 1 ? 'come' : 'comes'} down with ${c.name}.` : `${c.name} passes through the camp and somehow misses everyone.`}`
      // The rare one who cannot die of it.
      const strong = sick.filter((p) => p.mind.will > 70)
      if (strong.length && r.chance(0.18)) {
        const u = r.pick(strong)
        u.conds = u.conds.filter((cc) => cc.k !== 'zobae')
        u.conds.push({ k: 'undying', until: -1, note: c.name })
        u.facets.empathy = Math.max(0, u.facets.empathy - 60)
        u.facets.sociability = Math.max(0, u.facets.sociability - 60)
        text += ` ${P(u)} does not die of it. That is worse.`
      }
      if (sick.length) x.carried.push(c.key)
      break
    }
  }
  x.morale = Math.max(0, x.morale - 12 - died.length * 6)
  // Someone survived it to say what it is. Now it has a name inside the lake.
  const survivors = crew(w, x)
  let f = w.dc!.facts[c.key] != null ? w.facts.find((ff) => ff.id === w.dc!.facts[c.key]) : undefined
  if (!f && survivors.length) {
    f = addFact(w, { k: 'secret', s: -1, d: `calamity:${c.key}`, secret: 0.6, imp: 4, text: `${c.name}: ${c.desc}` })
    w.dc!.facts[c.key] = f.id
  }
  if (f) for (const p of survivors) learn(w, p, f)
  log(w, {
    type: 'calamity', imp: again && !died.length ? 3 : 5, who: survivors.map((p) => p.id).concat(died.map((p) => p.id)), at: pl.id, cause: x.ev,
    text: `${again ? `${c.name} finds ${x.name} again. ` : ''}${first && !c.canon ? `${x.name} meets something nobody inside the lake has ever recorded. They call it ${c.name}: ${c.desc.toLowerCase()} ` : ''}${text}${died.length > 1 ? ` ${died.length} are gone.` : ''}`,
  })
  for (const p of survivors) remember(w, p, { k: 'calamity', val: -60, str: 90, text: `Survived ${c.name}.` })
}

function turnHome(w: World, x: ExpeditionRun, why: string | null) {
  const r = rng(w)
  const port = w.places[x.port]
  const days = 40 + r.int(35)
  for (const p of crew(w, x)) { p.trip = { from: p.loc, to: port.id, t0: w.t, t1: w.t + days, mode: 'sea' }; p.loc = port.id; touch(w, p) }
  x.stage = 'returning'
  x.next = w.t + days
  x.arrive = w.t + days
  log(w, { type: 'expedition', imp: 3, who: x.members, cause: x.ev, text: why ? `${x.name} turns back halfway, with ${crew(w, x).length} left and nothing to show for it but the dead.` : `${x.name} turns for home with ${x.found.map((k) => w.dc!.calamities.find((c) => c.hope.key === k)?.hope.name).join(' and ')}.` })
  if (why) x.flags = { ...(x.flags || {}), halfway: 1 }
}

function lostForever(w: World, x: ExpeditionRun) {
  const left = x.members.map((id) => w.people[id]).filter((p) => p?.alive && p.flags.castaway)
  end(w, x, 'lost', `No word ever comes back from ${x.name}.${left.length ? ' Somewhere out there, some of them may still be alive.' : ''}`, 4)
}

function comeHome(w: World, x: ExpeditionRun) {
  const r = rng(w)
  const people = crew(w, x)
  const port = w.places[x.port]
  if (!people.length) { lostForever(w, x); return }
  if (r.chance(0.035)) {
    for (const p of people) kill(w, p, { cause: 'lost at sea on the way home from the Dark Continent', quiet: !p.major && !p.owned })
    end(w, x, 'lost', `${x.name} was seen once more, from a fishing boat, three days out from ${L(port)}. It never came in.`, 4)
    return
  }
  if (!x.legal && r.chance(0.3)) { caught(w, x, people, 'on the way home'); return }
  w.dc!.returned++
  const hopes = x.found.map((k) => w.dc!.calamities.find((c) => c.hope.key === k)?.hope).filter(Boolean) as HopeDef[]
  const lead = w.people[x.leader]
  for (const p of people) {
    p.fame += 35 + hopes.length * 25
    for (const d of p.dreams) if (d.k === 'explore' || d.k === 'discover') { d.done = w.t; d.prog = 100 }
    remember(w, p, { k: 'returned', val: 60, str: 90, text: `Came back from the Dark Continent with ${x.name}.` })
    for (const q of people) if (q !== p) change(w, p, q, { aff: 12, trust: 15, fam: 25 })
  }
  const halfway = (x.flags as { halfway?: number } | undefined)?.halfway
  const ev = end(w, x, 'home', `${x.name} comes home to ${L(port)}${halfway ? ', having turned back halfway' : ''}. ${people.length} of ${x.members.length} return.${hopes.length ? ` They carry ${hopes.map((h) => h.name).join(' and ')}.` : ''}${x.dead.length ? ` ${x.dead.length} died out there.` : ''}`, hopes.length ? 5 : 4)
  for (const h of hopes) bringHope(w, h, x.sponsor?.nation != null ? null : (lead?.alive ? lead : people[0]), x.sponsor?.nation ?? null, ev)
  // What came home with them, unnoticed.
  for (const k of [...new Set(x.carried)]) {
    const leaks = (w.flags.leaks ||= []) as { t: number; place: Id; cal: string; ev: Id; who: Id[] }[]
    leaks.push({ t: w.t + 8 + r.int(30), place: port.id, cal: k, ev, who: people.map((p) => p.id) })
  }
  // Knowledge spreads: they talk.
  for (const k of x.met) { const fid = w.dc!.facts[k]; if (fid != null) { const f = w.facts.find((ff) => ff.id === fid); if (f) f.secret = Math.min(f.secret, 0.4) } }
}

/* ================= Treasures ================= */

/** A hope arrives in the world: as a thing someone holds, or straight into
 *  a nation's vault. */
function bringHope(w: World, h: HopeDef, to: Person | null, nation: Id | null, ev?: Id): Item {
  w.dc!.hopes[h.key] = (w.dc!.hopes[h.key] || 0) + 1
  const n = nation != null ? w.nations[nation] : null
  const it = makeItem(w, 'hope', h.name, to ? to.id : -1, h.value, { key: h.key, use: h.use, uses: h.use === 'cure' ? 3 : 1 }, n ? n.capital : undefined)
  if (n && !to) applyHopeToNation(w, n, h, ev)
  addFact(w, { k: 'item', s: to ? to.id : -1, o: it.id, secret: 0.3, imp: 4, text: `${to ? to.name : n?.name} has ${h.name}, brought back from the Dark Continent.`, ev })
  // The greedy hear, and want it.
  for (const p of alive(w)) if (p !== to && p.facets.greed > 82 && power(p) > 90 && !p.dreams.some((d) => d.k === 'recover' && d.tag === 'hope') && rng(w).chance(0.3)) p.dreams.push({ k: 'recover', tag: 'hope', pri: 60, prog: 0, since: w.t, cause: ev })
  return it
}

function applyHopeToNation(w: World, n: import('../types').Nation, h: HopeDef, ev?: Id) {
  let text = ''
  switch (h.use) {
    case 'energy': n.gdp *= 1.2; n.tech = Math.min(100, n.tech + 6); text = `${h.name} goes into the ${N(n)}'s power plants. Within a year, its cities never go dark.`; break
    case 'alchemy': n.treasury += 4000; n.gdp *= 1.1; text = `${h.name} is planted under guard. The ${N(n)}'s treasury fills.`; break
    case 'water': n.stability = Math.min(100, n.stability + 15); for (const pl of w.places) if (pl.nation === n.id) clearHazard(w, pl, 'drought'); text = `${h.name} ends drought in the ${N(n)} for good.`; break
    case 'cure': n.stability = Math.min(100, n.stability + 8); for (const pl of w.places) if (pl.nation === n.id) clearHazard(w, pl, 'plague'); text = `The ${N(n)} uses ${h.name} to end every plague inside its borders.`; break
    case 'longevity': n.stability = Math.min(100, n.stability + 5); text = `The ${N(n)}'s rulers eat ${h.name}. They mean to rule for a very long time.`; { const ru = w.people[n.ruler]; if (ru?.alive) ru.span += 60 } break
    case 'weapon': n.arsenal.missiles += 60; n.mil.armor += 10; text = `${h.name} goes to the ${N(n)}'s weapon works.`; break
    case 'nen': n.mil.nen = n.mil.nen || []; text = `The ${N(n)}'s Nen corps begin training with ${h.name}.`; break
  }
  log(w, { type: 'politics', imp: 4, nats: [n.id], cause: ev, text })
  // Everyone else notices.
  for (const m of w.nations) if (m !== n && m.rel[n.id]) m.rel[n.id].op -= 10
}

/** People who hold a hope decide what to do with it. */
function hopesWeekly(w: World) {
  const r = rng(w)
  for (const it of w.items) {
    if (it.k !== 'hope' || it.holder < 0) continue
    const p = w.people[it.holder]
    if (!p?.alive) continue
    const d = it.data as { key: string; use: HopeDef['use']; uses: number }
    if (d.uses <= 0) continue
    switch (d.use) {
      case 'cure': {
        // Save someone they love first; then whoever is in front of them.
        const targets = [p, ...Object.keys(p.rel).map((id) => w.people[+id]).filter((q) => q?.alive && (p.rel[q.id].aff > 55 || isKin(p, q.id)))]
        const t = targets.find((q) => q.loc === p.loc && !q.trip && q.conds.some((c) => ['zobae', 'radiation', 'undying', 'contaminated', 'disease', 'kept'].includes(c.k) && c.k !== 'kept'))
        if (t) {
          const gone = cureAll(w, t)
          d.uses--
          log(w, { type: 'heal', imp: t.major || p.major ? 4 : 3, who: [p.id, t.id], at: p.loc, text: `${P(p)} gives ${t === p ? 'themselves' : P(t)} a dose of ${it.name}. ${gone.includes('undying') ? 'The thing that would not let them die lets go.' : 'Whatever was killing them is gone by morning.'}` })
          break
        }
        const pl = w.places[p.loc]
        if ((pl.hazards || []).some((h) => h.k === 'plague') && p.facets.empathy > 55) {
          clearHazard(w, pl, 'plague')
          d.uses--
          p.fame += 30
          log(w, { type: 'heal', imp: 4, who: [p.id], at: pl.id, text: `${P(p)} uses ${it.name} on the plague in ${L(pl)}. It ends.` })
        }
        break
      }
      case 'longevity':
        if (age(w, p) > 45 || p.facets.ambition > 80) { p.span += 50 + r.int(60); d.uses--; log(w, { type: 'misc', imp: 3, who: [p.id], at: p.loc, text: `${P(p)} eats ${it.name}. ${P(p)} may outlive everyone they know.` }) }
        break
      case 'nen':
        if (p.nen.awake) { p.nen.cap = Math.min(130, p.nen.cap + 10); p.nen.lvl = Math.min(p.nen.cap, p.nen.lvl + 8); d.uses--; log(w, { type: 'nen', imp: 3, who: [p.id], at: p.loc, text: `${P(p)} draws on ${it.name}. Their aura is not what it was. It is more.` }) }
        break
      default: {
        // Energy, water, alchemy, weapons: worth most to a nation. They sell.
        const n = w.nations[w.places[p.loc].nation] && w.nations[w.places[p.loc].nation].treasury > 500 ? w.nations[w.places[p.loc].nation] : w.nations.filter((m) => m.treasury > 500).sort((a, b) => b.treasury - a.treasury)[0]
        if (!n || !r.chance(0.3)) break
        const price = Math.min(n.treasury * 0.4, it.value * 0.2)
        n.treasury -= price
        p.jenny += price
        d.uses--
        it.holder = -1
        p.items = p.items.filter((i) => i !== it.id)
        it.place = n.capital
        log(w, { type: 'politics', imp: 4, who: [p.id], nats: [n.id], at: p.loc, text: `${P(p)} sells ${it.name} to the ${N(n)} for ${Math.round(price).toLocaleString('en-US')} million Jenny.` })
        applyHopeToNation(w, n, w.dc!.calamities.find((c) => c.hope.key === d.key)!.hope)
      }
    }
  }
}

/* ================= Calamities that come home ================= */

function leaksDaily(w: World) {
  const leaks = w.flags.leaks as { t: number; place: Id; cal: string; ev: Id; who: Id[] }[] | undefined
  if (!leaks?.length) return
  for (const lk of leaks.slice()) {
    if (w.t < lk.t) continue
    leaks.splice(leaks.indexOf(lk), 1)
    const c = cal(w, lk.cal)
    if (!c) continue
    const pl = w.places[lk.place]
    const kind = c.mode === 'guardian' ? 'beast' : c.mode === 'abduct' ? 'vanishing' : c.mode === 'frenzy' ? 'frenzy' : c.mode === 'gas' ? 'gas' : 'plague'
    const ev = log(w, { type: 'calamity', imp: 5, at: pl.id, cause: lk.ev, who: lk.who.slice(0, 6), text: `${c.name} has come home. ${c.leak} It began in ${L(pl)}, the port the expedition came back to.` })
    addHazard(w, pl, kind, 0.85, { ev, cal: c.key })
    startStory(w, 'calamity', `${c.name} inside the lake`, lk.who.slice(0, 6), ev, `leak-${c.key}-${lk.t}`)
    // The world now knows exactly what this is.
    const fid = w.dc!.facts[c.key]
    const f = fid != null ? w.facts.find((ff) => ff.id === fid) : undefined
    if (f) f.secret = -1
    // The Association puts a price on ending it.
    const ha = orgK(w, 'ha')
    if (kind === 'beast') { ha.treasury -= 300; w.flags.beastBounty = { place: pl.id, cal: c.key, reward: 800 } }
    // Those who brought it are blamed.
    for (const id of lk.who) { const p = w.people[id]; if (p?.alive) { p.infamy += 25; remember(w, p, { k: 'guilt', val: -60, str: 80, ev, text: `${c.name} came home with us.` }) } }
  }
}

/** The lost: people left alive out there. Sometimes, years later, one walks
 *  out of the sea. */
function castawaysWeekly(w: World) {
  const r = rng(w)
  for (const p of alive(w)) {
    if (!p.flags.castaway || p.trip) continue
    const kept = p.conds.some((c) => c.k === 'kept')
    if (!r.chance(kept ? 0.0025 : 0.006)) continue
    const port = r.pick(w.places.filter((q) => q.port && q.kind !== 'beyond' && q.hazard < 0.5))
    if (!port) continue
    p.conds = p.conds.filter((c) => c.k !== 'kept')
    const from = p.flags.castaway as string
    delete p.flags.castaway; delete p.flags.keptBy; delete p.flags.onExp
    p.loc = port.id; touch(w, p)
    p.fame += 40
    p.facets.empathy = Math.max(0, Math.min(100, p.facets.empathy + (r.chance(0.5) ? -25 : 15)))
    const curse = r.chance(0.25) ? calOfRegion(w, from) : undefined
    const yrs = (w.t - ((p.flags.castawayT as number) ?? w.t)) / 365
    const span = yrs < 1 ? `${Math.max(1, Math.round(yrs * 12))} months` : `${Math.round(yrs)} year${Math.round(yrs) === 1 ? '' : 's'}`
    delete p.flags.castawayT
    const ev = log(w, { type: 'expedition', imp: 5, who: [p.id], at: port.id, text: `${P(p)} walks out of the water at ${L(port)}, alone, ${kept ? `after ${span} as something's pet` : `${span} after everyone gave them up`}. They will not say much about ${regionName(w, from)}.` })
    remember(w, p, { k: 'returned', val: 40, str: 95, ev, text: 'Came back from the Dark Continent alone.' })
    if (curse) ((w.flags.leaks ||= []) as unknown[]).push({ t: w.t + 10 + r.int(30), place: port.id, cal: curse.key, ev, who: [p.id] })
  }
}

function capital(s: string) {
  const i = s.search(/[A-Za-z{]/)
  return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1)
}

export { knows }
