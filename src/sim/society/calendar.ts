/**
 * The world's calendar: the Hunter Exam every January, the Yorknew auction
 * every September (and whoever means to rob it), Battera's selection,
 * birthdays and old age.
 *
 * The Exam is played as the series plays it: several phases set by different
 * examiners, each one cutting the field, some of them killing candidates,
 * and a final in which friendships, grudges and one terrible mistake can
 * decide who walks out with a licence.
 */
import { L, O, P, log } from '../history'
import type { Id, OrgOp, Person, World } from '../types'
import { alive, at, members, orgK, personK, placeK, rng, touch } from '../world'
import { age, hpMax, power, inOrg } from '../people/person'
import { compatibility } from '../people/traits'
import { change, checkBonds, hasBond, setBond } from '../people/relations'
import { remember } from '../people/memory'
import { addWound } from '../people/health'
import { joinOrg } from './orgs'
import { fight } from '../combat/aftermath'
import { kill } from '../events/death'
import { dateOf, tickOf } from '../time'
import { batteraSelection } from './greed'
import { giveItem, makeItem } from './economy'
import { spawnCandidate } from '../worldgen/spawn'
import { startStory, endStory } from '../story/storyteller'
import { addFact, learn } from '../people/knowledge'
import { postContract } from './economy'
import { nenLongevity } from '../nen/nen'

export function calendarDaily(w: World) {
  const d = dateOf(w.epoch, w.t)
  // The Exam is announced in November for the following January.
  if (d.m === 10 && d.d === 1 && !w.flags.exam) announceExam(w, d.y + 1)
  const ex = w.flags.exam as ExamState | undefined
  if (ex) examDay(w, ex)
  // Battera holds his selection in the auction's first week.
  if (d.m === 8 && d.d === 5) batteraSelection(w)
  if (d.m === 8 && d.d === 1) auctionOpens(w)
  if (d.m === 8 && d.d === 10) auctionCloses(w)
  // Organisation operations falling due.
  for (const org of w.orgs) for (const op of org.ops.slice()) if (op.k === 'raid') raidDay(w, org.id, op)
  // Birthdays and old age.
  for (const p of alive(w)) {
    if ((w.t - p.born) % 365 !== 0 || w.t === p.born) continue
    const a = age(w, p)
    if (p.species === 'human' && a > 60) {
      const slow = Math.max(0.3, 1 - nenLongevity(p) / 40)
      p.attrs.str = Math.max(10, p.attrs.str - 0.8 * slow)
      p.attrs.agi = Math.max(10, p.attrs.agi - 0.8 * slow)
      p.attrs.refl = Math.max(10, p.attrs.refl - 0.6 * slow)
      if (p.nen.lvl > 30) p.nen.lvl -= 0.2 * slow
    }
    const span = p.span + nenLongevity(p) - Math.floor(p.nen.lifeSpent / 365)
    if (a >= span && rng(w).chance(0.35) && !(w.laws.plotArmor && (p.canon || p.owned))) {
      kill(w, p, { cause: 'old age', how: `${P(p)} dies of old age in ${L(w.places[p.loc])}, aged ${a}.` })
    }
  }
}

/* ================= The Hunter Exam ================= */

interface ExamState {
  n: number
  place: Id
  start: number
  phase: number
  next: number
  cand: Id[]
  out: Id[]
  examiners: Id[]
  ev?: Id
  year: number
}

const PHASES = [
  { k: 'run', n: 'endurance march', text: 'leads the candidates on a march that does not stop, through a swamp that eats the slow', fail: 0.4 },
  { k: 'cook', n: 'test of wits', text: 'sets a task with no right answer, only good ones', fail: 0.45 },
  { k: 'tower', n: 'tower of traps', text: 'drops the candidates into a tower whose every route is a trap', fail: 0.45 },
  { k: 'hunt', n: 'island hunt', text: 'turns the candidates loose on an island to take each other\'s badges', fail: 0.45 },
]

export function announceExam(w: World, year: number) {
  const r = rng(w)
  const ha = orgK(w, 'ha')
  if (ha.dead) return
  const n = (w.counters.examNo || 286) + 1
  w.counters.examNo = n
  const sites = w.places.filter((p) => p.kind === 'city' && !p.hidden && p.nation !== -1 && p.key !== 'meteor' && p.hazard < 0.2)
  const place = year === 1999 ? placeK(w, 'zaban') : r.pick(sites)
  const start = tickOf(w.epoch, year, 0, 7 + r.int(6))
  const ev = log(w, { type: 'exam', imp: 3, orgs: [ha.id], at: place.id, text: `The Hunter Association announces the ${n}th Hunter Exam. Its location is a secret only the worthy will find, in ${L(place)}.` })
  w.flags.exam = { n, place: place.id, start, phase: -1, next: start, cand: [], out: [], examiners: [], ev, year } as ExamState
  // Hopefuls everywhere decide to try.
  for (const p of alive(w)) {
    if (p.license || p.species !== 'human' || age(w, p) < 11 || age(w, p) > 35 || /prince|royal|ruler|don|officer|soldier|politician|butler/.test(p.role) || p.orgs.some((m) => ['troupe', 'kakin_royal', 'kakin_army', 'ants', 'gorteau_regime'].includes(w.orgs[m.org].key))) continue
    if (p.dreams.some((d) => d.k === 'hunter' && !d.done)) continue
    const keen = (p.facets.ambition + p.facets.curiosity) / 200 + (p.nen.awake ? 0.1 : 0)
    if (r.chance(keen * 0.06)) p.dreams.push({ k: 'hunter', pri: 50 + r.int(30), prog: 0, since: w.t, cause: ev })
  }
}

function examDay(w: World, ex: ExamState) {
  const r = rng(w)
  const ha = orgK(w, 'ha')
  if (w.t < ex.next) return
  const place = w.places[ex.place]
  if (ex.phase === -1) {
    // Day one: whoever made it is a candidate. Plenty of strangers make it too.
    const here = at(w, ex.place).filter((p) => !p.license && p.species === 'human' && (p.plan?.k === 'exam' || p.dreams.some((d) => d.k === 'hunter' && !d.done)) && !p.conds.length && !/prince|royal|ruler|officer|soldier/.test(p.role))
    const extras = 6 + r.int(8)
    for (let i = 0; i < extras; i++) here.push(spawnCandidate(w, ex.place))
    ex.cand = here.map((p) => p.id)
    const pool = members(w, ha.id).filter((m) => m.license && m.nen.lvl > 50 && !m.plan && m.alive && !inOrg(m, orgK(w, 'zodiacs').id))
    const canonEx = ['satotz', 'menchi', 'lippo'].map((k) => personK(w, k)).filter((p): p is Person => !!p && p.alive)
    ex.examiners = (ex.year === 1999 ? canonEx : r.shuffle(pool).slice(0, 3)).map((p) => p.id)
    touch(w)
    const named = here.filter((p) => p.major || p.owned || p.canon)
    ex.ev = log(w, {
      type: 'exam', imp: 4, who: here.map((p) => p.id), at: ex.place, orgs: [ha.id], cause: ex.ev,
      text: `The ${ex.n}th Hunter Exam begins in ${L(place)}. ${here.length + 300 + r.int(100)} candidates turn up${named.length ? `, among them ${named.slice(0, 6).map((p) => P(p)).join(', ')}` : ''}.`,
    })
    startStory(w, 'exam', `The ${ex.n}th Hunter Exam`, named.slice(0, 8).map((p) => p.id), ex.ev, `exam-${ex.n}`)
    for (const id of ex.cand) { const p = w.people[id]; p.plan = { k: 'exam', until: w.t + 20, why: 'taking the Hunter Exam' }; p.act = { k: 'duty', until: w.t + 2, note: `Taking the ${ex.n}th Hunter Exam` }; p.nextThink = w.t + 20 }
    ex.phase = 0
    ex.next = w.t + 2
    return
  }
  if (ex.phase < PHASES.length) {
    runPhase(w, ex, PHASES[ex.phase], ex.phase)
    ex.phase++
    ex.next = w.t + 2
    return
  }
  finishExam(w, ex)
}

function runPhase(w: World, ex: ExamState, ph: (typeof PHASES)[number], i: number) {
  const r = rng(w)
  const live = ex.cand.map((id) => w.people[id]).filter((p) => p.alive && !ex.out.includes(p.id))
  if (live.length <= 1) return
  const examiner = ex.examiners.length ? w.people[ex.examiners[i % ex.examiners.length]] : null
  const failed: Person[] = []
  const died: Person[] = []
  // Score each candidate on what the phase tests.
  const score = (p: Person) => {
    const a = p.attrs, m = p.mind
    switch (ph.k) {
      case 'run': return a.endu * 0.5 + m.will * 0.5 + (p.stam - 50) * 0.1
      case 'cook': return m.int * 0.35 + m.intuition * 0.35 + p.skills.cooking * 0.15 + p.skills.survival * 0.15 + p.facets.curiosity * 0.1
      case 'tower': return power(p) * 0.3 + m.int * 0.35 + m.intuition * 0.15 + p.skills.perception * 0.15 + p.facets.bravery * 0.1
      case 'hunt': return power(p) * 0.4 + p.skills.stealth * 0.2 + p.skills.tracking * 0.25 + m.intuition * 0.2
      default: return power(p)
    }
  }
  const noise = () => (r.next() - 0.5) * 24
  const ranked = live.map((p) => ({ p, s: score(p) + noise() })).sort((a, b) => b.s - a.s)
  const cut = Math.floor(ranked.length * ph.fail * (0.7 + r.next() * 0.6))
  // In the hunt, the dangerous ones hunt the weak; some for keeps.
  if (ph.k === 'hunt' || ph.k === 'tower') {
    const wolves = live.filter((p) => p.facets.cruelty > 65 || p.dreams.some((d) => d.k === 'chaos'))
    for (const wolf of wolves.slice(0, 3)) {
      const prey = live.filter((q) => q !== wolf && !died.includes(q) && (wolf.rel[q.id]?.aff ?? 0) < 30 && !hasBond(wolf.rel[q.id], 'friend') && !hasBond(q.rel[wolf.id], 'friend'))
      if (!prey.length || !r.chance(0.5)) continue
      const v = r.pick(prey)
      const out = fight(w, { a: [wolf], b: [v], intentA: wolf.facets.cruelty > 80 ? 'kill' : 'duel', place: ex.place, why: `during the Hunter Exam's ${ph.n}`, cause: ex.ev })
      for (const d of out.dead) died.push(d)
    }
  }
  // Candidates who get through something together become close, and people
  // find their own: kids find the other kids, the like-minded find each other.
  examGroups(w, live.filter((p) => !died.includes(p)), ph.k === 'run' ? 0.6 : 1)
  for (const x of ranked.slice(ranked.length - cut)) {
    if (died.includes(x.p)) continue
    failed.push(x.p)
    // Phases kill people.
    const danger = ph.k === 'tower' ? 0.08 : ph.k === 'run' ? 0.03 : ph.k === 'hunt' ? 0.05 : 0
    if (r.chance(danger * (w.laws.lethality / 0.5)) && power(x.p) < 35) {
      died.push(x.p)
      kill(w, x.p, { cause: `the Hunter Exam's ${ph.n}`, how: `${P(x.p)} dies in the ${ph.n} of the ${ex.n}th Hunter Exam.`, quiet: !x.p.major })
    } else if (r.chance(0.25)) {
      const wd = addWound(w, x.p, 0.2 + r.next() * 0.2)
      x.p.hp = Math.max(1, x.p.hp - hpMax(x.p) * 0.3)
      void wd
    }
  }
  for (const p of failed.concat(died)) ex.out.push(p.id)
  const left = live.length - failed.length - died.length
  const notable = failed.filter((p) => p.major || p.owned || p.canon)
  log(w, {
    type: 'exam', imp: notable.length || died.some((d) => d.major) ? 3 : 2, who: notable.map((p) => p.id), at: ex.place, cause: ex.ev,
    text: `Phase ${i + 1}: ${examiner ? P(examiner) : 'The examiner'} ${ph.text}. ${failed.length} fail${died.length ? `, ${died.length} die` : ''}. ${left} remain.${notable.length ? ` Out: ${notable.slice(0, 4).map((p) => P(p)).join(', ')}.` : ''}`,
  })
  for (const p of failed) remember(w, p, { k: 'exam_fail', val: -30, str: 40, text: `Failed the ${ex.n}th Hunter Exam.` })
}

function finishExam(w: World, ex: ExamState) {
  const r = rng(w)
  const ha = orgK(w, 'ha')
  const live = ex.cand.map((id) => w.people[id]).filter((p) => p.alive && !ex.out.includes(p.id))
  // The final: a bracket where only one candidate fails. Grudges and the
  // people inside your head can make it go badly wrong.
  let flunk: Person | null = null
  if (live.length >= 2) {
    // The final is a bracket where losing once only sends you to the next
    // match. Win by making the other give up; whoever gives up every time fails.
    const grit = (p: Person) => p.mind.will * 0.6 + power(p) * 0.25 + p.facets.pride * 0.15 + r.next() * 30
    const lo = live.slice().sort((a, b) => grit(a) - grit(b))[0]
    flunk = lo
    log(w, { type: 'exam', imp: 2, who: live.map((p) => p.id), at: ex.place, cause: ex.ev, text: `The final: ${live.length} candidates, one-on-one, until someone says "I give up". Losing a match only sends you to the next one. ${P(lo)} gives up the most.` })
    const bad = live.find((p) => p.flags.illumiNeedle && live.some((q) => q.key === 'illumi_zoldyck'))
    if (bad && r.chance(0.5)) {
      flunk = bad
      // The needle picks someone he barely knows: a stranger in the next match.
      const victim = live.filter((q) => q !== bad && q.key !== 'illumi_zoldyck' && (bad.rel[q.id]?.aff ?? 0) < 15 && (bad.rel[q.id]?.fam ?? 0) < 30 && !hasBond(bad.rel[q.id], 'friend'))
        .sort((a, b) => (a.major ? 1 : 0) - (b.major ? 1 : 0) || power(a) - power(b))[0]
      if (victim) {
        const ev = log(w, { type: 'exam', imp: 4, who: [bad.id, victim.id], at: ex.place, cause: ex.ev, text: `In the final, ${P(bad)} walks into someone else's match and kills ${P(victim)}. Nobody saw it coming, least of all ${P(bad)}. Disqualified.` })
        kill(w, victim, { cause: 'the final of the Hunter Exam', by: bad, ev })
      }
    }
  }
  const pass = live.filter((p) => p !== flunk && p.alive)
  for (const p of pass) {
    p.license = { t: w.t, stars: 0 }
    p.fame += 6
    if (['drifter', 'civilian', 'student', 'fighter', 'child'].includes(p.role)) p.role = 'rookie'
    for (const d of p.dreams) if (d.k === 'hunter') d.done = w.t
    // The exam's hidden half: a Hunter who cannot use Nen is not a Hunter
    // yet. Nobody says so out loud.
    if (!p.nen.awake && p.species === 'human' && !p.dreams.some((d) => d.k === 'master' && !d.done)) p.dreams.push({ k: 'master', pri: 78, prog: 0, since: w.t, tag: 'ura' })
    if (!inOrg(p, ha.id) && p.facets.loyalty > 25 && !p.orgs.some((m) => ['troupe', 'zoldyck'].includes(w.orgs[m.org].key))) joinOrg(w, p, ha, 0, { quiet: true })
    remember(w, p, { k: 'license', val: 60, str: 70, text: `Passed the ${ex.n}th Hunter Exam.` })
    // Article 2: a new Hunter who cannot use Nen goes looking for a teacher.
    if (!p.nen.awake && !p.dreams.some((d) => d.k === 'master' || d.k === 'strongest')) p.dreams.push({ k: 'strongest', pri: 55, prog: 0, since: w.t })
    p.plan = null
    p.nextThink = w.t
  }
  // Candidates who passed together are bonded by it.
  for (let i = 0; i < pass.length; i++) for (let j = i + 1; j < pass.length; j++) {
    const a = pass[i], b = pass[j]
    const ra = a.rel[b.id]
    if (ra && ra.aff > 20) { change(w, a, b, { aff: 10, trust: 8 }); change(w, b, a, { aff: 10, trust: 8 }) }
  }
  for (const id of ex.cand) { const p = w.people[id]; if (p.alive && p.plan?.k === 'exam') { p.plan = null; p.nextThink = w.t } }
  const names = pass.filter((p) => p.major || p.owned || p.canon).concat(pass.filter((p) => !(p.major || p.owned || p.canon)))
  const ev = log(w, {
    type: 'exam', imp: 4, who: pass.map((p) => p.id), at: ex.place, orgs: [ha.id], cause: ex.ev,
    text: `The ${ex.n}th Hunter Exam is over. ${pass.length} new Hunters: ${names.slice(0, 7).map((p) => P(p)).join(', ')}${names.length > 7 ? ` and ${names.length - 7} more` : ''}.`,
  })
  endStory(w, `exam-${ex.n}`, ev, `${pass.length} passed.`)
  // A free licence is worth a fortune: the next exam is a year away.
  delete w.flags.exam
}

/* ================= Yorknew ================= */

function auctionOpens(w: World) {
  const r = rng(w)
  const yk = placeK(w, 'yorknew')
  const mafia = orgK(w, 'mafia')
  if (mafia.dead) return
  const y = dateOf(w.epoch, w.t).y
  // Lots: Scarlet Eyes sold by collectors, copies of Greed Island, relics.
  const lots: Id[] = []
  const eyes = w.items.filter((it) => it.k === 'scarlet_eyes' && it.holder < 0 && it.place === yk.id)
  for (const it of eyes.slice(0, 2)) lots.push(it.id)
  for (let i = 0; i < 2 + r.int(3); i++) lots.push(makeItem(w, 'relic', r.pick(['a cursed Benz knife', 'a Dark Continent relic', 'a painting nobody can look at for long', 'the Kurta clan\'s last tapestry', 'a sealed music box']), -1, 30 + r.int(150), undefined, yk.id).id)
  if (!w.flags.giCleared) for (let i = 0; i < 2; i++) lots.push(makeItem(w, 'gi_copy', 'a copy of Greed Island', -1, 5800, undefined, yk.id).id)
  w.flags.auction = { year: y, lots }
  const ev = log(w, { type: 'auction', imp: 3, at: yk.id, orgs: [mafia.id], text: `The Yorknew underground auction opens. ${lots.length} great lots wait in the vaults${eyes.length ? `, among them ${eyes.length === 1 ? 'a pair' : `${eyes.length} pairs`} of Scarlet Eyes` : ''}.` })
  w.flags.auctionEv = ev
  // Word of the eyes spreads to anyone looking for them.
  if (eyes.length) {
    const f = addFact(w, { k: 'item', s: -1, o: eyes[0].id, d: 'auction', secret: 0.2, imp: 3, text: 'Scarlet Eyes are on sale at the Yorknew auction.', ev })
    for (const p of alive(w)) if (p.dreams.some((d) => d.k === 'recover' && d.tag === 'scarlet_eyes')) {
      learn(w, p, f)
      p.plan = { k: 'go', place: yk.id, until: w.t + 12, why: 'The Scarlet Eyes are at the Yorknew auction' }
      p.nextThink = w.t
    }
  }
}

function auctionCloses(w: World) {
  const r = rng(w)
  const a = w.flags.auction as { year: number; lots: Id[] } | undefined
  if (!a) return
  const yk = placeK(w, 'yorknew')
  const here = at(w, yk.id)
  for (const id of a.lots) {
    const it = w.items[id]
    if (!it || it.holder >= 0 || it.place !== yk.id) continue
    // Whoever wants it most and can pay.
    let best: Person | null = null, bs = 0
    for (const p of here) {
      let want = 0
      if (it.k === 'scarlet_eyes') want = p.dreams.some((d) => d.k === 'recover' && d.tag === 'scarlet_eyes') ? 3 : p.key === 'neon_nostrade' || p.key === 'tserriednich_hui_guo_rou' ? 2.5 : p.facets.greed / 80
      else if (it.k === 'gi_copy') want = p.key === 'battera' ? 4 : p.dreams.some((d) => d.k === 'clear') ? 2 : 0
      else want = p.facets.greed / 100 + (p.role === 'don' ? 0.5 : 0)
      const bid = Math.min(p.jenny * 0.8, it.value * want * (0.8 + r.next() * 0.6))
      if (want > 0 && bid >= it.value * 0.7 && bid > bs) { bs = bid; best = p }
    }
    if (best) {
      best.jenny -= bs
      giveItem(w, it, best)
      if (it.k === 'gi_copy') best.flags.giAccess = 1
      log(w, { type: 'auction', imp: best.major || it.k === 'scarlet_eyes' ? 3 : 1, who: [best.id], at: yk.id, cause: w.flags.auctionEv as Id, text: `${P(best)} buys ${it.name} at the Yorknew auction for ${Math.round(bs).toLocaleString('en-US')} million Jenny.` })
    }
  }
  delete w.flags.auction
}

/* ================= Raids ================= */

function raidDay(w: World, orgId: Id, op: OrgOp) {
  const org = w.orgs[orgId]
  const r = rng(w)
  const place = w.places[op.place!]
  // Before the day: everyone makes their way there.
  if (w.t < op.due) {
    if ((op.due - w.t) % 5 === 0) for (const m of members(w, orgId)) {
      if (m.loc !== place.id && !m.trip && !m.conds.length && m.plan?.k !== 'hunt' && r.chance(0.8)) {
        m.plan = { k: 'go', place: place.id, until: op.due + 3, why: `Moving with the ${org.short} on ${place.name}` }
        m.nextThink = w.t
      }
    }
    return
  }
  org.ops = org.ops.filter((o) => o !== op)
  const raiders = at(w, place.id).filter((p) => p.orgs.some((m) => m.org === orgId) && !p.conds.length)
  if (raiders.length < 3) {
    log(w, { type: 'faction', imp: 2, orgs: [orgId], cause: op.ev, text: `The ${O(org)} never gathers in strength at ${L(place)}. The job is called off.` })
    return
  }
  const mafia = orgK(w, 'mafia')
  // Yorknew is the Mafia's city; anywhere else, the local guard and any
  // Hunters in town stand in the way.
  const mafiaTown = place.key === 'yorknew' || place.features.includes('mafia')
  const defenders = at(w, place.id).filter((p) => !raiders.includes(p) && !p.conds.length && (
    mafiaTown ? (p.orgs.some((m) => w.orgs[m.org].kind === 'mafia' || w.orgs[m.org].key === 'nostrade') || p.role === 'guard') && p.nen.awake
      : p.role === 'guard' || p.role === 'soldier' || p.role === 'officer' || (p.license && p.nen.awake && p.facets.bravery > 50 && p.facets.cruelty < 60))).slice(0, 6)
  const ev = log(w, { type: 'faction', imp: 5, who: raiders.map((p) => p.id), at: place.id, orgs: [orgId], cause: op.ev, text: `The ${O(org)} strikes ${L(place)}${op.data?.auction ? ' on the night of the auction' : ''}.` })
  const out = fight(w, {
    a: raiders, b: defenders, intentA: 'kill', place: place.id, why: op.data?.auction ? 'during the raid on the auction' : 'during the raid', cause: ev, record: true,
    extrasB: [mafiaTown ? { name: 'Mafia guard', str: 50, agi: 45, tou: 50, skill: 55, weapon: 'smg', count: 10 } : { name: 'city guard', str: 48, agi: 45, tou: 50, skill: 50, weapon: 'rifle', count: 6 + Math.round(place.wealth * 8) }],
  })
  const won = out.res.winner === 0
  let loot = 0
  if (won) {
    const a = w.flags.auction as { lots: Id[] } | undefined
    const lots = (a?.lots || []).map((id) => w.items[id]).filter((it) => it && it.holder < 0)
    const holder = raiders.filter((p) => p.alive).sort((x, y) => (y.id === org.leader ? 1 : 0) - (x.id === org.leader ? 1 : 0))[0]
    for (const it of lots) { if (holder) giveItem(w, it, holder); loot += it.value }
    const take = mafiaTown ? 200 : 40 + place.wealth * 300
    org.treasury += take + loot * 0.05
    for (const p of raiders.filter((x) => x.alive)) p.jenny += take / Math.max(1, raiders.length) * 0.5
    if (mafiaTown) mafia.treasury -= 300
    place.wealth = Math.max(0.05, place.wealth - 0.05)
    for (const p of raiders) { p.infamy += 8; p.fame += 4; if (mafiaTown) p.flags.robbedMafia = 1 }
    log(w, { type: 'faction', imp: 4, who: raiders.map((p) => p.id), at: place.id, orgs: mafiaTown ? [orgId, mafia.id] : [orgId], cause: out.ev, text: `The ${O(org)} empties the vaults of ${L(place)}${lots.length ? `: ${lots.length} lots, worth ${Math.round(loot).toLocaleString('en-US')} million Jenny` : ''}. ${mafiaTown ? 'The Mafia Community swears every family will hunt them.' : `The ${w.nations[place.nation]?.name ?? 'city'} puts a price on every one of their heads.`}` })
    if (!mafiaTown) {
      const ha = orgK(w, 'ha')
      for (const p of raiders.filter((x) => x.alive)) postContract(w, { k: 'bounty', client: -ha.id - 1, target: p.id, reward: 60 + p.fame, why: `for the raid on ${place.name}`, cause: out.ev })
      endStory(w, `raid-${dateOf(w.epoch, w.t).y}`, out.ev, 'The vaults were emptied.')
      for (const p of raiders) if (p.alive && p.plan?.k === 'go') p.plan = null
      return
    }
    // The Ten Dons answer: bounties on every Spider, and the Zoldycks for the Head.
    for (const p of raiders.filter((x) => x.alive)) postContract(w, { k: 'bounty', client: -mafia.id - 1, target: p.id, reward: 150 + p.fame * 2, why: 'for robbing the auction', cause: out.ev })
    const head = w.people[org.leader]
    if (head?.alive) postContract(w, { k: 'assassination', client: -mafia.id - 1, target: head.id, reward: 2000, why: 'for robbing the auction', cause: out.ev })
    startStory(w, 'vendetta', 'The Mafia against the Troupe', raiders.slice(0, 5).map((p) => p.id), out.ev, `mafia-troupe-${dateOf(w.epoch, w.t).y}`)
    // The raiders' faces are known now.
    for (const p of raiders) { const f = addFact(w, { k: 'member', s: p.id, o: orgId, secret: 0.2, imp: 3, text: `${p.name} is a member of the ${org.name}.`, ev: out.ev }); for (const q of at(w, place.id)) learn(w, q, f) }
  } else {
    log(w, { type: 'faction', imp: 3, who: raiders.map((p) => p.id), at: place.id, orgs: [orgId], cause: out.ev, text: `The raid on ${L(place)} fails. The ${O(org)} scatters.` })
  }
  endStory(w, `raid-${dateOf(w.epoch, w.t).y}`, out.ev, won ? 'The vaults were emptied.' : 'The raid failed.')
  for (const p of raiders) if (p.alive && p.plan?.k === 'go') p.plan = null
  void setBond
}

/** Who sticks together during an exam phase. Each sociable candidate pulls in
 *  the two or three others they get on with best; everyone in a group warms
 *  to everyone else in it. */
function examGroups(w: World, live: Person[], scale: number) {
  const r = rng(w)
  const free = new Set(live)
  const order = live.slice().sort((a, b) => b.facets.sociability + b.facets.curiosity - a.facets.sociability - a.facets.curiosity)
  const pull = (a: Person, b: Person) => {
    const aa = age(w, a), ab = age(w, b)
    const kids = aa < 18 && ab < 18 ? 0.7 - Math.abs(aa - ab) * 0.08 : 0
    return compatibility(a, b) + kids + (a.rel[b.id]?.aff ?? 0) / 120 + (b.facets.empathy - 50) / 300 + r.next() * 0.35
  }
  for (const a of order) {
    if (!free.has(a) || a.facets.sociability < 25 && r.chance(0.6)) continue
    free.delete(a)
    const picks = [...free].filter((b) => (a.rel[b.id]?.aff ?? 0) > -20).map((b) => ({ b, s: pull(a, b) })).filter((x) => x.s > 0.25).sort((x, y) => y.s - x.s).slice(0, 1 + r.int(3))
    const g = [a, ...picks.map((x) => x.b)]
    for (const b of g) free.delete(b)
    for (const x of g) for (const y of g) if (x !== y) change(w, x, y, { aff: 13 * scale, trust: 10 * scale, fam: 15 * scale, resp: 5 * scale })
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) checkBonds(w, g[i], g[j])
  }
}
