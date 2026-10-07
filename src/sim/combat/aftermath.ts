/**
 * What a fight leaves behind: who dies, who is spared, who is taken, what was
 * stolen, sealed or learned, and how everyone feels about everyone after.
 *
 * Whether a beaten fighter dies is a choice the winner makes, from their own
 * intent and character and the rules they live by. A Zoldyck kills the
 * contract target and leaves the rest. Hisoka spares anyone he thinks will
 * be worth killing later. A Hunter brings a criminal in. Nobody dies in a
 * spar unless something goes badly wrong.
 */
import { L, P, log } from '../history'
import type { Hatsu, Id, Person, World } from '../types'
import { hpMax, auraMax, power } from '../people/person'
import { abilityFact, witness, addFact, learn } from '../people/knowledge'
import { change, foughtTogether, savedBy, sparred, hasBond } from '../people/relations'
import { remember } from '../people/memory'
import { awaken } from '../nen/nen'
import { kill } from '../events/death'
import { at, rng, touch } from '../world'
import { runFight, type F, type FightOpts, type FightResult } from './combat'
import { arenaResult } from '../society/arena'
import { breachRules } from '../society/rules'
import { touchStories } from '../story/storyteller'

export interface FightOutcome {
  res: FightResult
  ev: Id
  winners: Person[]
  losers: Person[]
  dead: Person[]
  captured: Person[]
  fled: Person[]
  how: string
}

export function fight(w: World, o: FightOpts): FightOutcome {
  const r = rng(w)
  const res = runFight(w, o)
  const F = res.fighters
  const place = w.places[o.place]
  const wSide = res.winner
  const named = (side: number) => F.filter((f) => f.side === side && f.p).map((f) => f.p!)
  const winners = wSide >= 0 ? named(wSide) : []
  const losers = wSide >= 0 ? named(1 - wSide) : []
  const dead: Person[] = [], captured: Person[] = [], fled: Person[] = []
  const lead = winners.find((p) => p.alive) || null
  const intent = wSide === 0 ? o.intentA : wSide === 1 ? (o.intentB || 'defend') : 'spar'
  const lethal = w.laws.lethality / 0.5
  const spar = o.intentA === 'spar' || !!o.arena
  const killLines: string[] = []

  // Write bodies back first: health, aura, stamina.
  for (const f of F) {
    if (!f.p) continue
    const p = f.p
    p.hp = Math.max(f.outState === 'down' ? 0 : 1, Math.round(f.hp))
    p.nen.aura = f.auraMax > 0 ? Math.max(0, f.aura / f.auraMax) : p.nen.aura
    p.stam = Math.max(0, p.stam - 25 - res.exchanges)
    p.lastFight = w.t
    p.stats.fights++
    if (f.outState === 'fled') fled.push(p)
    if (f.sealed > 30 && f.debt > 0) p.conds.push({ k: 'debt', until: w.t + 30, by: F.find((g) => g.side !== f.side && g.p && g.usedHatsu.size)?.p?.id, note: 'Hakoware bankruptcy' })
  }

  // The losers' fates.
  for (const f of F) {
    if (!f.p || wSide < 0 || f.side === wSide) continue
    const p = f.p
    const killer = f.killedBy != null ? F[f.killedBy]?.p : lead
    // A vow staked on this fight is paid in full.
    if (f.staked) {
      dead.push(p)
      killLines.push(`${P(p)} staked their life on "${f.staked.name}" and lost.`)
      continue
    }
    if (f.outState === 'fled' || f.outState === 'yield' && spar) continue
    if (f.outState === 'captured' || f.outState === 'controlled') {
      if ((intent === 'kill' || intent === 'war') && lead && r.chance(Math.min(0.95, 0.8 * lethal)) && !mercy(w, lead, p, intent)) { dead.push(p); continue }
      captured.push(p)
      continue
    }
    if (f.outState === 'down' || f.outState === 'yield') {
      if (spar) {
        if (f.hp <= -f.hpMax * 0.8 && r.chance(0.03 * lethal)) dead.push(p)
        continue
      }
      let pk = { duel: 0.05, kill: 0.88, war: 0.55, capture: 0.06, defend: 0.3, escape: 0.05, arena: 0, spar: 0 }[intent] * lethal
      if (f.hp <= -f.hpMax * 0.5) pk = Math.max(pk, 0.5 * lethal)
      if (f.outState === 'yield') pk *= 0.5
      if (killer && mercy(w, killer, p, intent)) pk *= 0.08
      if (killer && killer.facets.cruelty > 70) pk = Math.min(0.98, pk * 1.3)
      if (r.chance(Math.min(0.98, pk))) dead.push(p)
      else if (intent === 'capture' && lead) captured.push(p)
    }
  }

  // A vow that ends a fight: Gon's, or anyone's who gave everything.
  for (const f of F) {
    if (!f.p || !f.transformed && !f.p.flags.allIn) continue
    if (f.p.flags.allIn) {
      f.p.nen.burnedOut = true
      delete f.p.flags.allIn
      f.p.hp = Math.max(1, hpMax(f.p) * 0.05)
      f.p.conds.push({ k: 'unconscious', until: w.t + 60 })
    }
  }

  // Build the summary line.
  const A = o.a[0], B = o.b[0] || null
  const wLead = lead, lLead = losers[0] || null
  const why = o.why ? ` ${o.why}` : ''
  const locN = L(place)
  let text = ''
  let type = 'fight'
  const big = F.some((f) => f.p && (f.p.major || f.p.owned || f.p.fame >= 45))
  let imp = big ? 3 : F.filter((f) => f.p).length > 3 ? 2 : 1
  const extrasB = (o.extrasB || []).reduce((s, e) => s + e.count, 0)
  const extrasDown = F.filter((f) => f.extra && f.outState && f.outState !== 'fled').length
  if (spar) {
    imp = big ? 1 : 0
    text = wLead && lLead ? `${P(wLead)} beats ${P(lLead)}${o.arena ? ` on the floor of ${locN}` : ` in a sparring match in ${locN}`}${res.how === 'yield' ? `. ${P(lLead)} concedes.` : '.'}` : `${A ? P(A) : 'Two fighters'} and ${B ? P(B) : 'their opponent'} spar to a draw in ${locN}.`
  } else if (wSide < 0) {
    text = `${A ? P(A) : 'The attackers'} and ${B ? P(B) : extrasB ? `${extrasB} guards` : 'the defenders'} fight in ${locN}${why}. Neither side can finish it.`
  } else if (dead.length) {
    type = 'death'
    imp = Math.max(imp, dead.some((d) => d.major || d.owned || d.fame >= 40) ? 4 : 2)
    const names = dead.map((d) => P(d)).join(', ').replace(/, ([^,]*)$/, ' and $1')
    text = wLead ? `${P(wLead)}${winners.length > 1 ? ` and ${winners.length - 1 === 1 ? P(winners[1]) : 'their side'}` : ''} ${dead.length > 1 ? 'kill' : 'kills'} ${names} in ${locN}${why}.` : `${names} ${dead.length > 1 ? 'are' : 'is'} killed in ${locN}${why}.`
    if (wSide === 1 && o.intentA === 'kill' && dead.some((d) => o.a.includes(d))) text = `${A ? P(A) : 'An attacker'} comes for ${B ? P(B) : 'them'} in ${locN}${why}, and dies for it.`
  } else if (captured.length) {
    text = `${wLead ? P(wLead) : 'The winners'} ${captured.length > 1 ? 'take' : 'takes'} ${captured.map((c) => P(c)).join(' and ')} captive in ${locN}${why}.`
    imp = Math.max(imp, 2)
  } else if (res.how === 'fled') {
    text = lLead ? `${P(lLead)} escapes from ${wLead ? P(wLead) : 'their attackers'} in ${locN}${why}.` : `The defenders scatter in ${locN}${why}.`
  } else {
    text = wLead && lLead ? `${P(wLead)} defeats ${P(lLead)} in ${locN}${why} and leaves them alive.` : wLead && extrasB ? `${P(wLead)} cuts through ${extrasDown} of ${extrasB} guards in ${locN}${why}.` : `A fight in ${locN}${why}.`
  }
  if (extrasB && !spar && !text.includes('guards')) text += ` ${extrasDown} of ${extrasB} guards are down.`
  if (killLines.length) text += ' ' + killLines.join(' ')
  const keep = o.record || big || imp >= 2
  const beats = keep ? trimBeats(res.beats) : []
  const ev = log(w, {
    type, imp, text, who: F.filter((f) => f.p).map((f) => f.p!.id), at: o.place, cause: o.cause,
    data: { fight: { names: F.map((f) => f.token), sides: F.map((f) => f.side), hpMax: F.map((f) => f.hpMax), auraMax: F.map((f) => Math.round(f.auraMax)), people: F.map((f) => f.p?.id ?? -1), types: F.map((f) => f.p ? f.p.nen.type : -1), beats, winner: wSide, how: res.how, intent: o.intentA, why: o.why || '', exchanges: res.exchanges, night: false } },
  })

  // Knowledge: everyone who watched learns the abilities they saw.
  const watchers = at(w, o.place)
  for (const f of F) {
    if (!f.p) continue
    for (const hid of f.usedHatsu) {
      const h = f.p.nen.hatsu.concat(f.p.nen.stolen).find((x) => x.id === hid)
      if (!h) continue
      const fact = abilityFact(w, f.p, h.id, h.name)
      witness(w, fact, watchers)
      for (const g of F) if (g.p) learn(w, g.p, fact)
    }
  }

  // Relationships.
  for (const f of F) {
    if (!f.p) continue
    for (const g of F) {
      if (!g.p || g === f) continue
      if (g.side === f.side) { if (!spar && wSide === f.side && f.p.id < g.p.id) foughtTogether(w, f.p, g.p) }
      else if (spar) { if (f.side === 0 && wSide >= 0) sparred(w, f.p, g.p, wSide === 0) }
      else {
        change(w, f.p, g.p, { aff: o.intentA === 'duel' ? -3 : -18, resp: Math.round(g.dealt / Math.max(1, f.hpMax) * 25), fear: g.dealt > f.hpMax * 0.5 ? 12 : 0, fam: 3 })
      }
    }
    if (f.protect != null && f.side === wSide) {
      const ward = w.people[f.protect]
      if (ward && ward !== f.p && ward.alive) savedBy(w, ward, f.p, ev)
    }
  }

  // Wins, losses, fame, and a little growth from the experience.
  for (const p of winners) {
    p.stats.wins++
    const vs = losers.reduce((m, q) => Math.max(m, q.fame), 0)
    p.fame += spar ? 0.3 + vs * 0.03 : 1 + vs * 0.18
    if (p.nen.awake) p.nen.lvl = Math.min(p.nen.cap + 2, p.nen.lvl + 0.15 + Math.min(1, losers.reduce((m, q) => Math.max(m, q.nen.lvl), 0) / Math.max(10, p.nen.lvl)) * 0.35)
    p.skills.unarmed = Math.min(100, p.skills.unarmed + 0.3)
    remember(w, p, { k: 'win', val: 18, str: spar ? 15 : 35, ev, text: `Won a fight in ${place.name}.` })
  }
  for (const p of losers) {
    p.stats.losses++
    if (p.nen.awake && p.nen.lvl < p.nen.cap) p.nen.lvl += 0.12
    p.mood.fear = Math.min(100, p.mood.fear + (spar ? 3 : 20))
    if (!dead.includes(p)) remember(w, p, { k: 'loss', val: spar ? -8 : -30, str: spar ? 15 : 50, ev, text: `Lost a fight in ${place.name}.`, who: wLead?.id })
  }

  // Awakening by blows: Nen hitting a body with closed nodes can open them.
  for (const f of F) {
    if (!f.p || f.p.nen.awake || dead.includes(f.p)) continue
    const hitByNen = F.some((g) => g.side !== f.side && g.nen && g.dealt > 0)
    if (hitByNen && r.chance(o.arena ? 0.4 : 0.15)) awaken(w, f.p, 'trauma', undefined, ev)
  }

  // Theft of abilities, sealing, the debts of Hakoware.
  if (lead && wSide >= 0) {
    const thief = winners.find((p) => p.nen.hatsu.some((h) => h.effects.some((e) => e.k === 'steal')))
    if (thief && thief.nen.stolen.length < 8) {
      for (const v of losers.filter((q) => !dead.includes(q) && (captured.includes(q) || r.chance(0.35)))) {
        const cand = v.nen.hatsu.filter((h) => !h.effects.some((e) => e.k === 'steal'))
        if (!cand.length || !r.chance(0.65)) continue
        const h = cand.sort((a, b) => b.base - a.base)[0]
        v.nen.hatsu = v.nen.hatsu.filter((x) => x !== h)
        thief.nen.stolen.push({ ...h, from: v.id, id: `${v.id}:${h.name}` })
        log(w, { type: 'nen', imp: thief.major || v.major ? 3 : 2, who: [thief.id, v.id], at: o.place, cause: ev, text: `${P(thief)} takes "${h.name}" from ${P(v)}. It is written into their book, and ${P(v)} can no longer use it.` })
      }
    }
    // Absorption: Meruem grows by eating Nen users.
    const eater = winners.find((p) => p.nen.hatsu.some((h) => h.effects.some((e) => e.k === 'absorb')))
    if (eater) for (const v of dead.filter((d) => d.nen.awake)) {
      const gain = Math.min(8, 1 + v.nen.lvl / 18)
      eater.nen.lvl = Math.min(eater.nen.cap, eater.nen.lvl + gain)
      if (eater.species === 'ant') eater.attrs.str = Math.min(200, eater.attrs.str + 1)
      if (eater.major || v.major) log(w, { type: 'nen', imp: 2, who: [eater.id, v.id], at: o.place, cause: ev, text: `${P(eater)} consumes ${P(v)} and takes in their aura. Nen level ${Math.floor(eater.nen.lvl)}.` })
    }
  }
  for (const f of F) {
    if (!f.p || dead.includes(f.p)) continue
    if (f.p.flags.judgment != null) {
      const by = w.people[f.p.flags.judgment as number]
      f.p.conds.push({ k: 'judgment', until: -1, by: by?.id, note: 'Judgment Chain: no Nen, and no contact with the Spider, or the chain kills.' })
      f.p.conds.push({ k: 'sealed', until: -1, by: by?.id, note: 'Judgment Chain' })
      delete f.p.flags.judgment
      log(w, { type: 'nen', imp: 3, who: [f.p.id, by?.id ?? f.p.id], at: o.place, cause: ev, text: `${P(f.p)} lives, with a chain around the heart: no Nen, no contact with the Spider. Break either rule and it kills.` })
    }
  }

  // Captives: the Association jails criminals; others hold them.
  for (const c of captured) {
    c.conds.push({ k: 'captive', until: w.t + 14, by: lead?.id })
    remember(w, c, { k: 'captured', val: -40, str: 55, ev, text: `Taken captive by ${lead?.name ?? 'enemies'}.`, who: lead?.id })
  }

  // The dead.
  for (const d of dead) {
    const by = d.death ? undefined : (F.find((f) => f.p === d)?.killedBy != null ? F[F.find((f) => f.p === d)!.killedBy!]?.p : lead) || lead
    kill(w, d, { cause: `killed by ${by?.name ?? 'an enemy'} in ${place.name}`, by: by || null, ev })
  }

  // Rules the winners or losers just broke.
  breachRules(w, F, res, o, ev, dead)
  if (o.arena) arenaResult(w, winners, losers, ev)
  touchStories(w, ev, F.filter((f) => f.p).map((f) => f.p!.id))
  touch(w)
  return { res, ev, winners, losers, dead, captured, fled, how: res.how }
}

/** Does the winner let this one live? */
function mercy(w: World, winner: Person, loser: Person, intent: string): boolean {
  const r = rng(w)
  const rel = winner.rel[loser.id]
  if (rel && (rel.aff > 45 || hasBond(rel, 'sibling') || hasBond(rel, 'friend'))) return true
  // Hisoka: unripe fruit is left to ripen.
  if (winner.facets.cruelty > 70 && winner.facets.whimsy > 80 && loser.nen.pot > 1.1 && loser.nen.lvl < winner.nen.lvl * 0.7) return true
  // A Zoldyck only kills the contract.
  if (winner.orgs.some((m) => w.orgs[m.org]?.key === 'zoldyck') && !winner.plan?.data?.contract) return r.chance(0.85)
  if (intent !== 'kill' && intent !== 'war' && winner.facets.empathy > 55) return true
  if (winner.facets.empathy > 75 && winner.facets.cruelty < 30) return r.chance(0.7)
  return false
}

function trimBeats(b: F extends never ? never : FightResult['beats']): FightResult['beats'] {
  if (b.length <= 40) return b
  const head = b.slice(0, 10)
  const tail = b.slice(-14)
  const mid = b.slice(10, -14).sort((x, y) => y.w - x.w).slice(0, 16).sort((x, y) => b.indexOf(x) - b.indexOf(y))
  return head.concat(mid, tail)
}

export { power, auraMax, addFact }
export type { Hatsu }
