/**
 * Things that come from the Dark Continent.
 *
 * The Chimera Ant outbreak is not a button. A queen is carried across the
 * lake by chance (the world's seed decides whether, and when), washes ashore,
 * and starts eating. Everything after that follows from who is nearby, who
 * notices, and who the Hunter Association sends. The ants are born with the
 * series' names and natures, but what they do with them is their own.
 */
import { L, O, P, log } from '../history'
import type { Person, World } from '../types'
import { CANON_MORE } from '../../data/canon-more'
import { alive, at, members, orgK, personK, placeK, rng, touch, nationK } from '../world'
import { power, hpMax, inOrg } from '../people/person'
import { joinOrg, leaveOrg } from './orgs'
import { awaken } from '../nen/nen'
import { kill } from '../events/death'
import { fight } from '../combat/aftermath'
import { buildCanon } from '../worldgen/canon'
import { travel } from './travel'
import { change, hasBond } from '../people/relations'
import { remember } from '../people/memory'
import { startStory, endStory } from '../story/storyteller'
import { addFact, learn } from '../people/knowledge'
import { useRose } from './war'
import { addHazard } from './disasters'

interface AntState {
  t0: number
  stage: 'nest' | 'guards' | 'king' | 'palace' | 'fallen'
  born: number
  ev: number
  alerted: boolean
  teamSent: boolean
  pop: number
}

export function calamityDaily(w: World) {
  if (!w.laws.calamities) return
  const qd = w.flags.antQueenDay as number | undefined
  if (qd != null && w.t === qd && !w.flags.ants) queenArrives(w)
  const s = w.flags.ants as AntState | undefined
  if (s && s.stage !== 'fallen') antsDaily(w, s)
}

function queenArrives(w: World) {
  const ro = placeK(w, 'rokario')
  const ants = orgK(w, 'ants')
  ants.dead = false
  const queen = spawnAnt(w, 'chimera_ant_queen', ro.id)
  if (!queen) return
  ants.leader = queen.id
  const ev = log(w, { type: 'calamity', imp: 5, who: [queen.id], at: ro.id, text: `Something two metres long washes up on a beach in ${L(ro)}: a Chimera Ant queen, carried across the lake from the Dark Continent. She is hungry.` })
  w.flags.ants = { t0: w.t, stage: 'nest', born: 0, ev, alerted: false, teamSent: false, pop: 20 } as AntState
  startStory(w, 'outbreak', 'The Chimera Ants', [queen.id], ev, 'ants')
}

function spawnAnt(w: World, key: string, place: number): Person | null {
  if (personK(w, key)) return personK(w, key)!
  const def = CANON_MORE.find((d) => d.key === key)
  if (!def) return null
  const p = buildCanon(w, { ...def, appears: undefined, home: w.places[place].key, loc: w.places[place].key })
  p.born = w.t
  touch(w)
  return p
}

const SQUAD = ['colt', 'zazan', 'leol', 'welfin', 'cheetu', 'rammot', 'meleoron', 'ikalgo', 'flutter', 'bloster', 'koala', 'hina']

function antsDaily(w: World, s: AntState) {
  const r = rng(w)
  const org = orgK(w, 'ants')
  const ro = placeK(w, 'rokario'), ngl = placeK(w, 'ngl'), peijin = placeK(w, 'peijin')
  const queen = personK(w, 'chimera_ant_queen')
  const days = w.t - s.t0
  // The queen eats, and gives birth.
  if (queen?.alive && s.stage !== 'palace') {
    if (days % 3 === 0) {
      const lost = 0.4 + r.next() * 1.2
      w.places[ro.id].pop = Math.max(0, w.places[ro.id].pop - lost)
      w.places[ngl.id].pop = Math.max(0, w.places[ngl.id].pop - lost * 0.5)
      s.pop += 6
    }
    if (days % 9 === 4 && s.born < SQUAD.length) {
      const a = spawnAnt(w, SQUAD[s.born], ngl.id)
      s.born++
      if (a) log(w, { type: 'calamity', imp: 3, who: [a.id], at: ngl.id, cause: s.ev, text: `A new Chimera Ant squadron leader is born in ${L(ngl)}. It calls itself ${P(a)}, and it remembers being something else.` })
      // Some keep enough of the person they were fed from.
      if (a && a.facets.empathy > 50) a.flags.humanMemory = 1
    }
    if (days === 55) {
      s.stage = 'guards'
      // The Guard do not wander: wherever the King is, they are.
      for (const k of ['neferpitou', 'shaiapouf', 'menthuthuyoupi']) { const g = spawnAnt(w, k, ngl.id); if (g) g.flags.homebound = 1 }
      log(w, { type: 'calamity', imp: 5, at: ngl.id, cause: s.ev, text: `Three ants are born in ${L(ngl)} who are nothing like the others. The squadron leaders kneel without being told. They are the Royal Guard, and their aura can be felt for kilometres.` })
    }
    if (days === 95) {
      s.stage = 'king'
      const k = spawnAnt(w, 'meruem', ngl.id)
      if (k) {
        k.flags.homebound = 1
        org.leader = k.id
        const ev = log(w, { type: 'calamity', imp: 5, who: [k.id], at: ngl.id, cause: s.ev, text: `The King of the Chimera Ants tears his way out of his mother. ${P(queen)} is left dying. He does not look back, and he does not yet know his own name.` })
        kill(w, queen, { cause: 'giving birth to the King', ev, quiet: true })
        startStory(w, 'outbreak', 'The King', [k.id], ev, 'king')
      }
    }
  }
  const king = personK(w, 'meruem')
  // The King takes a country.
  if (s.stage === 'king' && king?.alive && days >= 105) {
    s.stage = 'palace'
    const ming = personK(w, 'ming_jol_ik')
    for (const a of members(w, org.id)) if (a.title === 'King' || a.title === 'Royal Guard') { if (a.loc !== peijin.id) travel(w, a, peijin.id, true) }
    const ev = log(w, { type: 'calamity', imp: 5, who: [king.id], at: peijin.id, cause: s.ev, text: `The King walks into the palace of East Gorteau. ${ming?.alive ? `${P(ming)} lasts one sentence. ` : ''}The country is his.` })
    if (ming?.alive) kill(w, ming, { cause: 'killed by the Chimera Ant King', by: king, ev, quiet: false })
    const eg = nationK(w, 'egorteau')
    eg.ruler = king.id
    eg.rulerTitle = 'King'
    eg.stability = 5
    w.flags.selection = w.t + 40
    // A blind girl who plays Gungi is summoned to play the King.
    const komugi = personK(w, 'komugi')
    if (komugi?.alive) {
      komugi.loc = peijin.id
      touch(w)
      change(w, king, komugi, { fam: 30, resp: 20 })
      w.flags.gungi = 1
      log(w, { type: 'calamity', imp: 4, who: [king.id, komugi.id], at: peijin.id, cause: ev, text: `${P(king)} has the best Gungi player in the world brought to the palace, meaning to crush her. ${P(komugi)} beats him.` })
    }
  }
  // The King and Komugi: every game changes him a little.
  const komugi = personK(w, 'komugi')
  if (w.flags.gungi && king?.alive && komugi?.alive && king.loc === komugi.loc) {
    change(w, king, komugi, { aff: 0.8, resp: 0.6, fam: 0.5 })
    change(w, komugi, king, { aff: 0.6, fam: 0.5, trust: 0.4 })
    if (king.facets.cruelty > 30) king.facets.cruelty -= 0.12
    if (king.facets.empathy < 60) king.facets.empathy += 0.1
    if ((king.rel[komugi.id]?.aff ?? 0) > 60 && !king.flags.named) {
      king.flags.named = 1
      log(w, { type: 'calamity', imp: 4, who: [king.id, komugi.id], at: king.loc, text: `Somewhere in a hundred games of Gungi, ${P(king)} stops wanting to win against ${P(komugi)}, and starts wanting to know her.` })
    }
  }
  // The selection: mass forced awakening in East Gorteau.
  if (w.flags.selection && w.t === w.flags.selection && king?.alive) {
    delete w.flags.selection
    const pg = w.places[peijin.id]
    pg.pop = Math.max(0, pg.pop * 0.6)
    log(w, { type: 'calamity', imp: 5, who: [king.id], at: peijin.id, text: `The "selection" in ${L(peijin)}: five million people are gathered in the square to have their aura forced open by Shaiapouf. Those who survive will be food, or soldiers.` })
  }
  // Wherever ants are, the place is deadly, and people who can leave do.
  for (const a of members(w, org.id)) {
    if (a.trip) continue
    addHazard(w, w.places[a.loc], 'ants', 0.6, { ev: s.ev })
  }
  // Ants roam and hunt.
  for (const a of members(w, org.id)) {
    if (!a.alive || a.trip || a.title === 'Queen') continue
    if (a.flags.free && a.flags.humanMemory && r.chance(0.01)) defect(w, a)
    if (a.title === 'Squadron Leader' && r.chance(0.05)) {
      const near = w.places.filter((x) => ['rokario', 'ngl', 'peijin', 'wgorteau'].includes(x.key))
      const dest = r.pick(near)
      if (dest.id !== a.loc) travel(w, a, dest.id, true)
    }
    // The King's Gungi player is not food: the Guards see to it.
    const prey = at(w, a.loc).filter((q) => q.species !== 'ant' && !q.conds.length && q.lastFight < w.t - 1 && q.key !== 'komugi')
    if (prey.length && a.title !== 'King' && r.chance(0.25)) {
      const v = r.pick(prey)
      if (!a.flags.humanMemory || r.chance(0.3)) fight(w, { a: [a], b: [v], intentA: 'kill', place: a.loc, why: 'as the ants hunt', cause: s.ev })
    }
  }
  // The Association notices.
  if (!s.alerted && (days > 25 || members(w, org.id).some((a) => a.stats.kills > 0))) {
    s.alerted = true
    const ha = orgK(w, 'ha')
    const ev = log(w, { type: 'calamity', imp: 5, orgs: [ha.id], cause: s.ev, text: `Word reaches the ${O(ha)}: something in ${L(ngl)} is eating people and learning from it. Hunters are called to stop the Chimera Ants.` })
    const f = addFact(w, { k: 'secret', s: -1, d: 'ants', secret: -1, imp: 5, text: 'Chimera Ants are loose in NGL.', ev })
    void f
    // The call goes out, but the Zodiacs stay at their posts and most Hunters
    // have their own work. A few go: the brave, the ones it is their job.
    const zod = orgK(w, 'zodiacs')
    for (const h of members(w, ha.id)) {
      const job = ['beast', 'blacklist', 'crime', 'contract', 'master', 'rookie'].includes(h.role)
      if (h.nen.lvl > 55 && h.facets.bravery > 60 && !h.plan && h.license && job && h.id !== ha.leader && !inOrg(h, zod.id) && r.chance(0.18)) {
        h.plan = { k: 'go', place: ngl.id, until: w.t + 120, why: 'Answering the Association\'s call against the Chimera Ants', ev }
        h.nextThink = w.t
      }
    }
  }
  // The Chairman goes himself, with the strongest he trusts.
  if (s.stage === 'palace' && !s.teamSent && w.t > (w.flags.ants as AntState).t0 + 130) {
    s.teamSent = true
    strikeTeam(w, s)
  }
  if (w.flags.palaceAssault && w.t >= (w.flags.palaceAssault as number)) palaceAssault(w, s)
  // When the King is gone, the swarm falls apart.
  if (s.stage === 'palace' && king && !king.alive) {
    s.stage = 'fallen'
    const left = members(w, org.id)
    const ev = log(w, { type: 'calamity', imp: 5, cause: s.ev, text: `With the King dead, the Chimera Ant swarm comes apart. ${left.length} ants remain, each now free to decide what they are.` })
    for (const a of left) { a.flags.free = 1; if (a.flags.humanMemory || a.facets.empathy > 40) defect(w, a) }
    endStory(w, 'ants', ev, 'The King is dead.')
    endStory(w, 'king', ev, 'The King is dead.')
  }
}

function defect(w: World, a: Person) {
  const org = orgK(w, 'ants')
  if (!a.orgs.some((m) => m.org === org.id)) return
  leaveOrg(w, a, org, 'defected', undefined, `${P(a)} walks away from the Chimera Ants. Whatever it was before it was an ant, it remembers now.`)
  a.dreams = a.dreams.filter((d) => d.k !== 'serve')
  a.dreams.push({ k: 'peace', pri: 50, prog: 0, since: w.t })
  remember(w, a, { k: 'defect', val: 30, str: 70, text: 'Left the swarm.' })
}

function strikeTeam(w: World, s: AntState) {
  const r = rng(w)
  const ha = orgK(w, 'ha')
  const peijin = placeK(w, 'peijin')
  const chair = w.people[ha.leader]
  // The Chairman takes a few he trusts, not the Zodiacs, who must keep the
  // Association running; each brings the students they trust in a fight.
  const zod = orgK(w, 'zodiacs')
  const strong = members(w, ha.id).filter((h) => h !== chair && h.nen.lvl > 60 && h.facets.bravery > 50 && !h.conds.length && !inOrg(h, zod.id) && (!chair || (chair.rel[h.id]?.aff ?? 0) > 20 || h.fame > 50))
    .sort((a, b) => power(b) - power(a)).slice(0, 3)
  const team = [chair, ...strong].filter((p, i, a) => p && p.alive && a.indexOf(p) === i)
  for (const t of team.slice()) for (const q of alive(w)) if (hasBond(t.rel[q.id], 'student') && q.nen.lvl > 45 && !team.includes(q) && !q.conds.length && team.length < 8) team.push(q)
  // A Zoldyck can be hired to carry the Chairman in.
  const zeno = personK(w, 'zeno_zoldyck')
  if (chair?.alive && zeno?.alive && !team.includes(zeno) && !zeno.conds.length) {
    team.push(zeno)
    log(w, { type: 'job', imp: 3, who: [chair.id, zeno.id], cause: s.ev, text: `${P(chair)} hires ${P(zeno)} for one job: get him to the King. Nothing more, at Zeno's insistence.` })
  }
  if (!team.length) return
  const ev = log(w, { type: 'calamity', imp: 5, who: team.map((p) => p.id), orgs: [ha.id], at: peijin.id, cause: s.ev, text: `${chair?.alive ? `${P(chair)} leads` : 'The Association sends'} a team into East Gorteau to kill the King: ${team.map((p) => P(p)).join(', ')}.` })
  // The V5 give the Chairman a weapon of last resort.
  if (chair?.alive && chair.nen.lvl > 80) {
    chair.flags.rose = 1
    addFact(w, { k: 'secret', s: chair.id, d: 'rose', secret: 0.95, imp: 5, text: `${chair.name} carries a Poor Man's Rose inside his own body.` })
  }
  for (const p of team) { p.plan = { k: 'go', place: peijin.id, until: w.t + 60, why: 'The assault on the King\'s palace', ev }; p.nextThink = w.t }
  w.flags.palaceAssault = w.t + 18
  w.flags.strikeTeam = team.map((p) => p.id)
  startStory(w, 'war', 'The palace invasion', team.map((p) => p.id), ev, 'palace')
}

function palaceAssault(w: World, s: AntState) {
  delete w.flags.palaceAssault
  const peijin = placeK(w, 'peijin')
  const team = ((w.flags.strikeTeam as number[]) || []).map((id) => w.people[id]).filter((p) => p.alive && p.loc === peijin.id && !p.trip)
  const org = orgK(w, 'ants')
  const king = personK(w, 'meruem')
  const guards = members(w, org.id).filter((a) => a.title === 'Royal Guard' && a.alive && a.loc === peijin.id)
  if (!team.length || !king?.alive) return
  const ev = log(w, { type: 'calamity', imp: 5, who: team.map((p) => p.id).concat(king.id), at: peijin.id, cause: s.ev, text: `The palace invasion begins. Zeno's dragons fall from the sky over ${L(peijin)} and the Hunters go in.` })
  const chair = team.find((p) => p.flags.rose) || team.sort((a, b) => power(b) - power(a))[0]
  const rest = team.filter((p) => p !== chair)
  // The team splits the Royal Guard off from the King.
  for (let i = 0; i < guards.length; i++) {
    const side = rest.filter((_, j) => j % Math.max(1, guards.length) === i)
    if (side.length && guards[i].alive) fight(w, { a: side, b: [guards[i]], intentA: 'kill', place: peijin.id, why: 'in the palace invasion', cause: ev, record: true })
  }
  // The Chairman and the King, alone.
  const out = fight(w, { a: [chair], b: [king], intentA: 'kill', place: peijin.id, why: 'in the palace invasion', cause: ev, record: true, maxExchanges: 70 })
  // Canon: the Chairman takes the King far from the palace first, so the
  // Rose takes the two of them and the open ground, and nobody else.
  if (king.alive && chair.alive && chair.flags.rose) {
    useRose(w, chair, king, out.ev, true)
    // The Guards who tend their King afterwards carry the poison back with them.
    for (const g of guards) if (g.alive) g.conds.push({ k: 'contaminated', until: w.t + 300, p: 2.5, note: 'the Rose\'s poison' })
    const komugi = personK(w, 'komugi')
    if (komugi?.alive && (king.rel[komugi.id]?.aff ?? 0) > 40) komugi.flags.staysWithKing = 1
  }
}

export { hpMax, joinOrg, awaken }
