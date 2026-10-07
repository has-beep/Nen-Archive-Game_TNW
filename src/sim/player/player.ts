/**
 * What the player can do. On purpose, not much, and never directly.
 *
 * The player owns a character (made from scratch, or brought in from their
 * Nen Archive Original Character). At turning points the world stops and asks
 * what that character does: a crossroad. The character may still refuse an
 * answer that goes against everything they are. When the character is ready
 * to build a Hatsu, the player designs it in the Forge, under the same rules
 * as the Nen Archive's ability builder.
 *
 * Beyond their own character, the player has influence, earned slowly, to
 * nudge the world through the people in it: a rumour planted in a city, a
 * bounty posted with their character's money, a meeting arranged. Nothing
 * spawns from nowhere. Every nudge goes through the simulation.
 */
import { L, P, log } from '../history'
import type { Crossroad, CrossroadOption, HatsuCond, HatsuSpec, Id, Person, World } from '../types'
import { rng, at, touch, personK } from '../world'
import { swearAllIn, swearVow } from '../nen/vows'
import { compileSpec } from '../nen/hatsu'
import { develop } from '../nen/nen'
import { addFact, learn } from '../people/knowledge'
import { postContract } from '../society/economy'
import { change, setBond } from '../people/relations'
import { remember } from '../people/memory'
import { travel } from '../society/travel'

export const TIER_INFLUENCE: Record<string, { perDay: number; max: number; owned: number; forgeSlots: number; whispers: number }> = {
  free: { perDay: 0.5, max: 20, owned: 1, forgeSlots: 1, whispers: 1 },
  supporter: { perDay: 0.75, max: 40, owned: 2, forgeSlots: 1, whispers: 2 },
  coffee: { perDay: 1.25, max: 100, owned: 10, forgeSlots: 3, whispers: 4 },
}

export function tierInfo(w: World) {
  return TIER_INFLUENCE[w.player.tier] || TIER_INFLUENCE.free
}

export function playerDaily(w: World) {
  const t = tierInfo(w)
  w.player.influence = Math.min(t.max, w.player.influence + t.perDay)
  // Crossroads nobody answered resolve themselves, as the character would.
  for (const c of w.player.crossroads) {
    if (c.chosen || w.t < c.expires) continue
    const best = c.options.slice().sort((a, b) => b.fit - a.fit)[0]
    resolve(w, c, best.k, true)
  }
  w.player.crossroads = w.player.crossroads.filter((c) => !c.chosen || w.t - c.t < 30)
}

export function offerCrossroad(w: World, p: Person, c: { title: string; prompt: string; options: CrossroadOption[]; ctx: Record<string, unknown>; days?: number }): Crossroad {
  const cr: Crossroad = { id: w.player.nextId++, pid: p.id, t: w.t, title: c.title, prompt: c.prompt, options: c.options, expires: w.t + (c.days ?? 5), ctx: c.ctx }
  w.player.crossroads.push(cr)
  log(w, { type: 'crossroad', imp: 3, who: [p.id], at: p.loc, text: `${P(p)} stands at a crossroad: ${c.title}.` })
  return cr
}

/**
 * The player answers. A choice that goes hard against a character's nature
 * may be refused: you can push Gon, but you cannot make him abandon a friend.
 */
export function choose(w: World, id: Id, k: string): { ok: boolean; refused?: boolean; msg: string } {
  const c = w.player.crossroads.find((x) => x.id === id)
  if (!c || c.chosen) return { ok: false, msg: 'That moment has passed.' }
  const o = c.options.find((x) => x.k === k)
  if (!o) return { ok: false, msg: 'No such choice.' }
  w.player.log.push({ t: w.t, k: 'choose', data: { id, k } })
  const p = w.people[c.pid]
  if (o.fit < 0.25 && rng(w).chance(0.6 - o.fit)) {
    c.refused = true
    const best = c.options.slice().sort((a, b) => b.fit - a.fit)[0]
    log(w, { type: 'crossroad', imp: 3, who: [p.id], at: p.loc, text: `${P(p)} cannot bring themselves to ${o.label.toLowerCase()}. It is not who they are.` })
    resolve(w, c, best.k, true)
    return { ok: true, refused: true, msg: `${p.short} refuses. It is not who they are.` }
  }
  resolve(w, c, k, false)
  return { ok: true, msg: `${p.short}: ${o.label}.` }
}

function resolve(w: World, c: Crossroad, k: string, auto: boolean) {
  c.chosen = k
  const p = w.people[c.pid]
  if (!p.alive) return
  const ctx = c.ctx as Record<string, number>
  const killer = ctx.killer != null && ctx.killer >= 0 ? w.people[ctx.killer] : null
  const dead = ctx.dead != null ? w.people[ctx.dead] : null
  switch (k) {
    case 'avenge_vow':
      if (killer?.alive) {
        p.dreams.push({ k: 'avenge', target: killer.id, pri: 95, prog: 0, since: w.t, cause: ctx.ev })
        if (p.nen.awake) swearVow(w, p, { person: killer }, 4, ctx.ev, dead ? `for ${dead.name}` : undefined)
        else log(w, { type: 'vow', imp: 3, who: [p.id, killer.id], at: p.loc, text: `${P(p)} swears to kill ${P(killer)}. They have no Nen to bind to it yet. They will.` })
        setBond(w, p, killer, 'nemesis')
      } else p.dreams.push({ k: 'avenge', target: -1, tag: String(dead?.id ?? -1), pri: 90, prog: 0, since: w.t })
      break
    case 'avenge':
      if (killer?.alive) { p.dreams.push({ k: 'avenge', target: killer.id, pri: 80, prog: 0, since: w.t }); setBond(w, p, killer, 'nemesis') }
      else p.dreams.push({ k: 'avenge', target: -1, tag: String(dead?.id ?? -1), pri: 70, prog: 0, since: w.t })
      log(w, { type: 'vow', imp: 3, who: killer ? [p.id, killer.id] : [p.id], at: p.loc, text: killer ? `${P(p)} will hunt ${P(killer)} down.` : `${P(p)} will find out who did it.` })
      break
    case 'all_in':
      if (killer?.alive) swearAllIn(w, p, killer, ctx.ev)
      break
    case 'grieve':
      p.mood.grief = Math.min(100, p.mood.grief + 15)
      p.act = { k: 'mourn', until: w.t + 5, note: dead ? `Grieving for ${dead.name}` : 'Grieving' }
      p.nextThink = w.t + 5
      break
    case 'forgive':
      p.mood.anger = Math.max(0, p.mood.anger - 40)
      p.facets.empathy = Math.min(100, p.facets.empathy + 3)
      if (killer) change(w, p, killer, { aff: 25 })
      log(w, { type: 'crossroad', imp: 2, who: [p.id], at: p.loc, text: `${P(p)} chooses not to hate${killer ? ` ${P(killer)}` : ''}.` })
      break
    case 'join': {
      const org = w.orgs[ctx.org]
      if (org) { const { joinOrg } = ORGS; joinOrg(w, p, org, 0, {}) }
      break
    }
    case 'decline': break
    case 'forge_auto': develop(w, p); break
    case 'fight': case 'flee': case 'talk':
      p.flags.stance = k
      break
    case 'confess': p.flags.confess = ctx.target; break
    case 'spare': p.flags.spare = 1; break
    case 'kill': p.flags.spare = 0; break
  }
  if (!auto) remember(w, p, { k: 'choice', val: 5, str: 30, text: `Chose: ${c.options.find((o) => o.k === k)?.label}.` })
}

/* ================= The Hatsu Forge ================= */

export function offerForge(w: World, p: Person) {
  if (w.player.crossroads.some((c) => c.pid === p.id && c.ctx.forge && !c.chosen)) return
  offerCrossroad(w, p, {
    title: 'A Hatsu is ready to be born',
    prompt: `${p.short} has learned enough to build an ability of their own. Design it in the Forge, or let it grow from who they are.`,
    options: [
      { k: 'forge', label: 'Design it', desc: 'Open the Forge: choose categories, effects and conditions.', fit: 1 },
      { k: 'forge_auto', label: 'Let it grow', desc: 'Their personality and history decide.', fit: 0.9 },
    ],
    ctx: { forge: 1 },
    days: 14,
  })
}

/** The player's own design. Conditions buy power; the budget is the same 100
 *  points the Nen Archive builder uses, spread by efficiency. */
export function forge(w: World, pid: Id, spec: HatsuSpec): { ok: boolean; msg: string } {
  const p = w.people[pid]
  if (!p || !p.owned || !p.alive) return { ok: false, msg: 'Not your character.' }
  const slots = tierInfo(w).forgeSlots
  const forged = p.nen.hatsu.filter((h) => h.by === p.id).length
  if (forged >= slots && !w.player.crossroads.some((c) => c.pid === pid && c.ctx.forge && !c.chosen)) return { ok: false, msg: `Your tier allows ${slots} designed ${slots === 1 ? 'ability' : 'abilities'} per character.` }
  const h = compileSpec(sanitize(spec), p, w.t)
  develop(w, p, { spec: h })
  for (const c of w.player.crossroads) if (c.pid === pid && c.ctx.forge && !c.chosen) c.chosen = 'forge'
  w.player.log.push({ t: w.t, k: 'forge', data: { pid, name: spec.name } })
  return { ok: true, msg: `${p.short} develops ${h.name}.` }
}

function sanitize(s: HatsuSpec): HatsuSpec {
  const name = String(s.name || 'Unnamed').replace(/[{}<>]/g, '').slice(0, 40)
  const cats = (s.cats || []).slice(0, 3).map(([c, wgt]) => [Math.max(0, Math.min(5, c | 0)), Math.max(0.05, Math.min(1, wgt))] as [0 | 1 | 2 | 3 | 4 | 5, number])
  const total = cats.reduce((x, [, wgt]) => x + wgt, 0) || 1
  const effects = (s.effects || []).slice(0, 3).map((e) => ({ ...e, p: Math.max(0.5, Math.min(2.6, e.p)) }))
  const conds = (s.conds || []).slice(0, 5).map((c: HatsuCond) => ({ ...c, stars: Math.max(1, Math.min(5, c.stars | 0)), text: String(c.text).slice(0, 140) }))
  return { name, kind: s.kind || 'custom', cats: cats.map(([c, wgt]) => [c, wgt / total]), effects, conds, base: Math.max(0.8, Math.min(1.25, s.base ?? 1)), desc: String(s.desc || '').slice(0, 300) }
}

/* ================= Nudges ================= */

export interface FateResult { ok: boolean; msg: string }

export const FATE_COST = { rumor: 6, bounty: 4, meet: 8, whisper: 12, gift: 2, send: 3 }

export function fate(w: World, k: keyof typeof FATE_COST, a: Record<string, number | string>): FateResult {
  const cost = FATE_COST[k]
  if (w.player.influence < cost) return { ok: false, msg: `Needs ${cost} influence.` }
  const me = w.people[w.player.owned[0] ?? -1]
  const r = rng(w)
  let res: FateResult = { ok: false, msg: 'Nothing happens.' }
  switch (k) {
    case 'rumor': {
      // A rumour about someone, planted in one place. It spreads like any other.
      const s = w.people[+a.subject]
      const place = w.places[+a.place]
      if (!s || !place) break
      const f = addFact(w, { k: 'rumor', s: s.id, d: String(a.kind || 'whereabouts'), truth: false, secret: 0.2, imp: 2, text: String(a.text || `${s.name} has been seen in ${place.name}.`).slice(0, 160) })
      const here = at(w, place.id)
      for (const q of here.slice(0, 6)) learn(w, q, f)
      // Rumours of whereabouts send people who care.
      if (a.kind === 'whereabouts' || !a.kind) for (const q of here) q.seen[s.id] = [+a.where || place.id, w.t]
      log(w, { type: 'fate', imp: 1, who: [s.id], at: place.id, text: `A rumour starts going round ${L(place)} about ${P(s)}.` })
      res = { ok: true, msg: `The rumour is out in ${place.name}.` }
      break
    }
    case 'bounty': {
      if (!me?.alive) return { ok: false, msg: 'You need a living character to post a bounty.' }
      const t = w.people[+a.target]
      const amt = Math.max(1, Math.min(me.jenny, +a.amount || 10))
      if (!t?.alive) break
      me.jenny -= amt
      postContract(w, { k: 'bounty', client: me.id, target: t.id, reward: amt, why: `posted by ${me.name}` })
      log(w, { type: 'fate', imp: 2, who: [me.id, t.id], at: me.loc, text: `${P(me)} posts a bounty of ${Math.round(amt)} million Jenny on ${P(t)}.` })
      res = { ok: true, msg: `Bounty posted on ${t.name}.` }
      break
    }
    case 'meet': {
      // Two people your character knows are asked to come to one place.
      const x = w.people[+a.a], y = w.people[+a.b], place = w.places[+a.place]
      if (!x?.alive || !y?.alive || !place || !me) break
      for (const q of [x, y]) {
        const willing = (q.rel[me.id]?.aff ?? 0) > 10 || q.facets.curiosity > 70
        if (willing) { q.plan = { k: 'go', place: place.id, until: w.t + 30, why: `Meeting someone in ${place.name}, at ${me.name}'s request` }; q.nextThink = w.t }
      }
      log(w, { type: 'fate', imp: 1, who: [me.id, x.id, y.id], at: place.id, text: `${P(me)} arranges for ${P(x)} and ${P(y)} to meet in ${L(place)}.` })
      res = { ok: true, msg: 'The invitations are sent.' }
      break
    }
    case 'whisper': {
      // A nudge to someone's next decision. It works on how they already lean.
      const t = w.people[+a.target]
      if (!t?.alive) break
      t.flags.whisper = String(a.act)
      t.nextThink = w.t
      res = { ok: true, msg: `${t.short} feels an urge they cannot place.` }
      break
    }
    case 'gift': {
      const t = w.people[+a.target]
      const amt = Math.max(0, Math.min(me?.jenny ?? 0, +a.amount || 1))
      if (!me || !t?.alive) break
      me.jenny -= amt; t.jenny += amt
      change(w, t, me, { aff: Math.min(20, amt / 2), debt: 0.5 })
      res = { ok: true, msg: `${t.short} receives the gift.` }
      break
    }
    case 'send': {
      const p = w.people[+a.who]
      const place = w.places[+a.place]
      if (!p?.owned || !place) break
      p.plan = { k: 'go', place: place.id, until: w.t + 60, why: `Heading to ${place.name}` }
      p.nextThink = w.t
      res = { ok: true, msg: `${p.short} sets out for ${place.name}.` }
      break
    }
  }
  if (res.ok) { w.player.influence -= cost; w.player.log.push({ t: w.t, k: 'fate:' + k, data: a }) }
  void r; void touch; void personK; void remember; void travel
  return res
}

import * as ORGS from '../society/orgs'
