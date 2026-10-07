/**
 * Nations week by week: money, stability, how they feel about each other,
 * when grievances become wars, and the great political question of the age:
 * whether anyone will break the Inviolability Treaty and sail for the Dark
 * Continent.
 *
 * Kakin is the one that will try. When it does, the V5 face a choice the
 * series spells out: oppose it, or admit Kakin, become the V6, and send the
 * Hunter Association along to keep watch. Whatever they choose, fourteen
 * princes board one ship, and the old law of Kakin's succession begins.
 */
import { L, N, O, P, log } from '../history'
import type { Id, Nation, Person, World } from '../types'
import { alive, members, nationK, orgK, personK, placeK, rng, touch } from '../world'
import { age, power } from '../people/person'
import { develop } from '../nen/nen'
import { joinOrg } from './orgs'
import { atWar, declareWar, warBetween } from './war'
import { travel } from './travel'
import { kill } from '../events/death'
import { startStory, endStory } from '../story/storyteller'
import { remember } from '../people/memory'
import { dateOf } from '../time'

function rel(a: Nation, b: Nation) {
  return a.rel[b.id] || (a.rel[b.id] = { op: 0, ally: false, nap: false, trade: false, sanction: false })
}

export function nationsWeekly(w: World) {
  const r = rng(w)
  for (const n of w.nations) {
    if (n.gov === 'stateless') continue
    // Money: the economy pays for the army, corruption skims.
    n.treasury += n.gdp * (0.6 - n.traits.corruption / 300) - (n.mil.troops * 0.0004 + n.mil.armor * 0.02 + n.mil.air * 0.03 + n.mil.navy * 0.02) * (0.6 + n.traits.militarism / 200)
    n.gdp *= 1 + (0.0004 - (atWar(w, n.id) ? 0.002 : 0) - (n.stability < 30 ? 0.001 : 0))
    n.stability = Math.max(0, Math.min(100, n.stability + (n.treasury > 0 ? 0.15 : -0.4) - (atWar(w, n.id) ? 0.3 : 0) - n.weariness / 400))
    n.mil.readiness = Math.max(20, n.mil.readiness - 0.4)
    n.mil.morale = Math.min(90, n.mil.morale + 0.3)
    n.weariness = Math.max(0, n.weariness - (atWar(w, n.id) ? 0 : 1.5))
    // A ruler who dies is replaced.
    const ruler = w.people[n.ruler]
    if (n.ruler >= 0 && (!ruler || !ruler.alive)) replaceRuler(w, n)
    // Opinions drift back toward neutral; neighbours rub each other wrong.
    for (const o of w.nations) {
      if (o === n || o.gov === 'stateless') continue
      const rr = rel(n, o)
      rr.op += (0 - rr.op) * 0.004
      if (n.blocs.some((b) => o.blocs.includes(b))) rr.op = Math.min(100, rr.op + 0.08)
    }
  }
  // Incidents: spies caught, insults, border shootings.
  if (r.chance(0.05)) {
    const ns = w.nations.filter((n) => n.gov !== 'stateless' && n.key !== 'free')
    const a = r.pick(ns), b = r.pick(ns)
    if (a !== b) {
      const d = 6 + r.int(14)
      rel(a, b).op -= d; rel(b, a).op -= d
      const what = r.pick([`A ${a.short} spy ring is uncovered in the ${b.short} capital`, `${a.short} and ${b.short} patrol boats exchange fire`, `${a.short}'s ambassador walks out of a summit in ${b.short}`, `${b.short} seizes a ${a.short} freighter`])
      log(w, { type: 'diplomacy', imp: 2, nats: [a.id, b.id], text: `${what}. Relations between the ${N(a)} and the ${N(b)} sour.` })
    }
  }
  // Wars begin when hatred, ambition and opportunity line up.
  if (w.laws.wars) for (const a of w.nations) {
    if (a.gov === 'stateless' || atWar(w, a.id) || a.mil.troops < 50) continue
    for (const b of w.nations) {
      if (b === a || b.gov === 'stateless' || b.key === 'free') continue
      const rr = rel(a, b)
      if (rr.op > -65 || rr.nap && rr.op > -85 || warBetween(w, a.id, b.id)) continue
      if (a.blocs.includes('V5') && b.blocs.includes('V5')) continue
      const want = (a.traits.expansion + a.traits.militarism) / 200 * (a.mil.troops / Math.max(1, b.mil.troops + 1)) * 0.5
      if (r.chance(Math.min(0.08, want * 0.05))) { declareWar(w, a, b, 'settle its grievances'); break }
    }
  }
  expeditionWeekly(w)
}

function replaceRuler(w: World, n: Nation) {
  const r = rng(w)
  const pool = alive(w).filter((p) => p.nation === n.id && /politician|officer|royal|prince|don/.test(p.role) && age(w, p) >= 25)
  const next = pool.sort((a, b) => b.facets.ambition + b.fame - a.facets.ambition - a.fame)[0]
  if (next) {
    n.ruler = next.id
    next.role = 'ruler'
    next.title = n.rulerTitle
    log(w, { type: 'politics', imp: 4, who: [next.id], nats: [n.id], text: `${P(next)} becomes ${n.rulerTitle} of the ${N(n)}.` })
  } else {
    n.ruler = -1
    n.stability = Math.max(0, n.stability - 20)
    log(w, { type: 'politics', imp: 3, nats: [n.id], text: `The ${N(n)} has no one at its head. Generals and ministers circle.` })
  }
  void r
}

/* ================= The Dark Continent expedition ================= */

interface Expedition {
  status: 'announced' | 'crisis' | 'boarding' | 'sailing' | 'arrived' | 'over'
  port: Id
  depart: number
  arrive: number
  ev: number
  v6?: boolean
}

function expeditionWeekly(w: World) {
  const r = rng(w)
  const kakin = nationK(w, 'kakin')
  const king = w.people[kakin.ruler]
  const beyond = personK(w, 'beyond_netero')
  const netero = personK(w, 'netero')
  const exp = w.flags.expedition as Expedition | undefined
  if (!exp) {
    // Beyond waits for his father; Kakin waits for Beyond.
    const free = beyond?.alive && (!netero || !netero.alive || w.t > 1100)
    if (free && king?.alive && king.dreams.some((d) => d.k === 'explore') && r.chance(0.04)) {
      const port = placeK(w, 'kakinport')
      const ev = log(w, { type: 'politics', imp: 5, who: [king.id, beyond!.id], nats: [kakin.id], text: `${P(king)} goes before the world: Kakin will send an expedition to the Dark Continent, led by ${P(beyond!)}, son of Isaac Netero. The Inviolability Treaty is two hundred years old, and Kakin never signed it.` })
      w.flags.expedition = { status: 'announced', port: port.id, depart: w.t + 240, arrive: 0, ev } as Expedition
      startStory(w, 'expedition', 'The Dark Continent Expedition', [king.id, beyond!.id], ev, 'expedition')
      for (const n of w.nations) if (n.blocs.includes('V5')) { rel(n, kakin).op -= 30; rel(kakin, n).op -= 15 }
    }
    return
  }
  if (exp.status === 'announced' && w.t > exp.depart - 220) {
    exp.status = 'crisis'
    const ha = orgK(w, 'ha')
    const v5 = w.nations.filter((n) => n.blocs.includes('V5'))
    const anger = v5.reduce((s, n) => s + Math.max(0, -rel(n, kakin).op), 0) / Math.max(1, v5.length)
    // The compromise the series reached, or war.
    if (anger < 70 || r.chance(0.75)) {
      exp.v6 = true
      for (const n of v5) { n.blocs = n.blocs.filter((b) => b !== 'V5').concat('V6'); rel(n, kakin).op += 35 }
      kakin.blocs.push('V6')
      const v = orgK(w, 'v5')
      v.name = 'The V6'
      v.short = 'V6'
      const ev = log(w, { type: 'politics', imp: 5, nats: [kakin.id, ...v5.map((n) => n.id)], orgs: [ha.id], cause: exp.ev, text: `The V5 do not go to war. They admit Kakin, and become the V6. The ${O(ha)} will sail with the expedition and keep watch on ${beyond?.alive ? P(beyond) : 'its leader'}.` })
      // The Zodiacs and Hunters who want to go get their place.
      for (const z of members(w, orgK(w, 'zodiacs').id)) z.flags.expedition = 1
      for (const p of alive(w)) if (p.dreams.some((d) => d.k === 'explore') || p.dreams.some((d) => d.k === 'recover' && d.tag === 'scarlet_eyes')) p.flags.expedition = 1
      void ev
    } else {
      const lead = v5.sort((a, b) => b.mil.troops - a.mil.troops)[0]
      declareWar(w, lead, kakin, 'stop the voyage to the Dark Continent', exp.ev)
      exp.depart += 120
    }
  }
  if (exp.status === 'crisis' && w.t >= exp.depart - 30) {
    exp.status = 'boarding'
    const royal = orgK(w, 'kakin_royal')
    for (const p of members(w, royal.id)) p.flags.expedition = 1
    if (beyond?.alive) beyond.flags.expedition = 1
    log(w, { type: 'politics', imp: 4, cause: exp.ev, at: exp.port, text: `Boarding begins at ${L(w.places[exp.port])}. The Black Whale No. 1 will carry two hundred thousand people, every prince of Kakin among them.` })
    for (const p of alive(w)) if (p.flags.expedition && p.loc !== exp.port && !p.trip) { p.plan = { k: 'go', place: exp.port, until: exp.depart + 5, why: 'Boarding the Black Whale' }; p.nextThink = w.t }
  }
  if (exp.status === 'boarding' && w.t >= exp.depart) depart(w, exp)
  if (exp.status === 'sailing') sailing(w, exp)
}

function depart(w: World, exp: Expedition) {
  const ship = placeK(w, 'blackwhale')
  const port = w.places[exp.port]
  ship.hidden = false
  ship.x = port.x; ship.y = port.y + 1
  const aboard = alive(w).filter((p) => p.flags.expedition && (p.loc === exp.port || p.orgs.some((m) => w.orgs[m.org].key === 'kakin_royal')))
  for (const p of aboard) { p.trip = undefined; p.loc = ship.id }
  touch(w)
  exp.status = 'sailing'
  exp.arrive = w.t + 75
  const ev = log(w, { type: 'politics', imp: 5, who: aboard.slice(0, 10).map((p) => p.id), at: ship.id, cause: exp.ev, text: `The Black Whale No. 1 sails from ${L(port)} with ${aboard.length} named souls aboard and two hundred thousand others. Seventy-five days to the New Continent.` })
  // The King's succession contest begins as the ship leaves port.
  const royal = orgK(w, 'kakin_royal')
  const heirs = members(w, royal.id).filter((p) => p.title && /Prince/.test(p.title) && p.loc === ship.id)
  if (heirs.length >= 2) {
    w.flags.succession = { t: w.t, ev }
    const e2 = log(w, { type: 'faction', imp: 5, who: heirs.map((p) => p.id), at: ship.id, orgs: [royal.id], cause: ev, text: `As the coast falls away, the King of Kakin's voice reaches every prince: the Succession War has begun. ${heirs.length} heirs. One throne. A Guardian Spirit Beast wakes beside each of them.` })
    startStory(w, 'succession', 'The Kakin Succession War', heirs.map((p) => p.id), e2, 'succession')
    for (const h of heirs) {
      // Each prince's beast is their destined ability with no level requirement.
      if (h.nen.destined?.some((d) => d.kind === 'spirit_beast')) {
        const spec = h.nen.destined.find((d) => d.kind === 'spirit_beast')!
        h.nen.destined = h.nen.destined.filter((d) => d !== spec)
        if (!h.nen.awake) { h.nen.awake = true; h.nen.lvl = Math.max(h.nen.lvl, 12) }
        const { compileSpec } = HATSU
        h.nen.hatsu.push(compileSpec(spec, h, w.t))
      }
      const d = h.dreams.find((x) => x.k === 'rule')
      if (d) d.pri = Math.min(100, d.pri + 15)
    }
  }
}

function sailing(w: World, exp: Expedition) {
  const r = rng(w)
  const ship = placeK(w, 'blackwhale')
  const dc = placeK(w, 'dc_shore')
  const port = w.places[exp.port]
  const k = Math.min(1, (w.t - (exp.arrive - 75)) / 75)
  ship.x = port.x + (dc.x - port.x) * k
  ship.y = port.y + (dc.y - port.y) * k
  // Princes hunt princes. Most hide behind their guards; the ruthless move.
  const royal = orgK(w, 'kakin_royal')
  const heirs = members(w, royal.id).filter((p) => p.title && /Prince/.test(p.title) && p.loc === ship.id)
  if (w.flags.succession) {
    for (const h of heirs) {
      if (h.facets.cruelty < 55 || h.plan?.k === 'hunt' || !r.chance(0.15)) continue
      const rivals = heirs.filter((x) => x !== h)
      if (!rivals.length) continue
      const t = rivals.sort((a, b) => power(a) - power(b))[0]
      h.plan = { k: 'hunt', target: t.id, until: w.t + 30, why: 'in the Kakin Succession War', data: { intent: 'kill' } }
      h.nextThink = w.t
    }
    if (heirs.length === 1) {
      const king = heirs[0]
      king.title = 'King'
      const ev = log(w, { type: 'faction', imp: 5, who: [king.id], orgs: [royal.id], at: ship.id, text: `${P(king)} is the last heir of Kakin alive. The Succession War is over.` })
      const kakin = nationK(w, 'kakin')
      const old = w.people[kakin.ruler]
      if (old?.alive) { old.title = 'Former King' }
      kakin.ruler = king.id
      royal.leader = king.id
      remember(w, king, { k: 'throne', val: 80, str: 90, ev, text: 'Became King of Kakin.' })
      delete w.flags.succession
      endStory(w, 'succession', ev, `${king.name} won.`)
    }
  }
  if (w.t >= exp.arrive) {
    exp.status = 'arrived'
    const aboard = alive(w).filter((p) => p.loc === ship.id)
    const ev = log(w, { type: 'politics', imp: 5, who: aboard.slice(0, 10).map((p) => p.id), at: dc.id, cause: exp.ev, text: `The Black Whale reaches the New Continent. What waits there has been waiting a very long time.` })
    // Those who go ashore face the calamities.
    for (const p of aboard) {
      if (!(p.dreams.some((d) => d.k === 'explore') || p.key === 'beyond_netero') ) continue
      travel(w, p, dc.id, true)
      if (r.chance(0.25 * (w.laws.lethality / 0.5)) && power(p) < 90) kill(w, p, { cause: 'the Dark Continent', how: `${P(p)} goes ashore on the Dark Continent and is not seen again.`, ev })
      else { p.fame += 30; for (const d of p.dreams) if (d.k === 'explore') d.done = w.t }
    }
    endStory(w, 'expedition', ev, 'The ship reached the New Continent.')
    exp.status = 'over'
  }
}

import * as HATSU from '../nen/hatsu'
export { develop, joinOrg }
