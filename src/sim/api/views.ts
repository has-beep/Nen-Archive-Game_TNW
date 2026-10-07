/**
 * Views: plain, serialisable snapshots of the world for the interface.
 *
 * The interface never touches the world directly (it lives in a worker).
 * It asks for a view, and gets back exactly what one screen needs, with
 * every name a piece of text refers to resolved in `names`.
 */
import { BOND_LABEL, NEN_COLORS, NEN_TYPES, ROLES, TECHS, FACETS, VALUES, NEEDS, SKILLS, type Bond } from '../constants'
import { HAZARDS } from '../../data/hazards'
import { eventById } from '../history'
import type { HistEvent, Id, Person, Place, World } from '../types'
import { alive, at, members } from '../world'
import { age, auraMax, hpMax, power } from '../people/person'
import { bondsOf } from '../people/relations'
import { EFFECT_LABEL, catLine } from '../nen/hatsu'
import { dateStr, shortDate } from '../time'
import { activeRuns } from '../society/expeditions'
import { tierInfo, FATE_COST } from '../player/player'

/* ---------------- Names for tokens ---------------- */

export interface NameRef { n: string; c?: string; dead?: boolean }
export interface Names { p: Record<Id, NameRef>; o: Record<Id, NameRef>; n: Record<Id, NameRef>; l: Record<Id, NameRef> }

const TOKEN = /\{([ponl])(\d+)\}/g

export function names(w: World, texts: string[], extraPeople: Id[] = []): Names {
  const out: Names = { p: {}, o: {}, n: {}, l: {} }
  const addP = (id: Id) => { const p = w.people[id]; if (p) out.p[id] = { n: p.name, c: p.nen.awake && p.nen.known ? NEN_COLORS[p.nen.type] : undefined, dead: !p.alive } }
  for (const id of extraPeople) addP(id)
  for (const t of texts) {
    for (const m of t.matchAll(TOKEN)) {
      const id = +m[2]
      if (m[1] === 'p') addP(id)
      else if (m[1] === 'o' && w.orgs[id]) out.o[id] = { n: w.orgs[id].name, c: w.orgs[id].color }
      else if (m[1] === 'n' && w.nations[id]) out.n[id] = { n: w.nations[id].name, c: w.nations[id].color }
      else if (m[1] === 'l' && w.places[id]) out.l[id] = { n: w.places[id].name }
    }
  }
  return out
}

export interface EventLite { id: Id; t: number; date: string; type: string; imp: number; text: string; who: Id[]; at?: Id; cause?: Id; fight?: boolean }
export function lite(w: World, e: HistEvent): EventLite {
  return { id: e.id, t: e.t, date: shortDate(w.epoch, e.t), type: e.type, imp: e.imp, text: e.text, who: e.who, at: e.at, cause: e.cause, fight: !!(e.data && (e.data as { fight?: unknown }).fight) }
}

/* ---------------- The frame: what changes every tick ---------------- */

export interface Frame {
  t: number
  date: string
  dateShort: string
  alive: number
  follow: Id
  influence: number
  influenceMax: number
  tier: string
  crossroads: number
  /** Everyone not travelling, by place, and everyone travelling, as map dots. */
  dots: { id: Id; x: number; y: number; c: string; big: boolean; own: boolean; f: boolean }[]
  hazards: { id: Id; x: number; y: number; k: string; sev: number; color: string; label: string }[]
  fronts: { a: Id; d: Id; place: Id; x: number; y: number }[]
  ticker: EventLite[]
  names: Names
  followLine?: string
  expeditions: number
}

export function frame(w: World, fresh: Id[], minImp = 3): Frame {
  const t = tierInfo(w)
  const f = w.people[w.player.follow]
  const dots: Frame['dots'] = []
  for (const p of alive(w)) {
    let x: number, y: number
    if (p.trip) {
      const a = w.places[p.trip.from], b = w.places[p.trip.to]
      const k = Math.max(0, Math.min(1, (w.t - p.trip.t0) / Math.max(1, p.trip.t1 - p.trip.t0)))
      x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k
    } else {
      const pl = w.places[p.loc]
      if (pl.hidden && pl.kind !== 'beyond' && pl.kind !== 'ship') continue
      // Spread people around their place so a crowd is visible as a crowd.
      const a = (p.id * 2.399) % (Math.PI * 2), r0 = 0.35 + ((p.id * 7) % 10) / 14
      x = pl.x + Math.cos(a) * r0; y = pl.y + Math.sin(a) * r0
    }
    dots.push({ id: p.id, x, y, c: p.species === 'ant' ? '#b91c1c' : p.nen.awake ? NEN_COLORS[p.nen.type] : '#94a3b8', big: p.major || p.fame > 40, own: !!p.owned, f: p.id === w.player.follow })
  }
  const hazards: Frame['hazards'] = []
  for (const pl of w.places) for (const h of pl.hazards || []) if (h.sev > 0.05) hazards.push({ id: pl.id, x: pl.x, y: pl.y, k: h.k, sev: h.sev, color: HAZARDS[h.k].color, label: HAZARDS[h.k].label })
  const fronts: Frame['fronts'] = []
  for (const wr of w.wars) if (wr.end == null) for (const fr of wr.fronts) { const pl = w.places[fr.place]; if (pl) fronts.push({ a: wr.a[0], d: wr.d[0], place: pl.id, x: pl.x, y: pl.y }) }
  const watch = new Set(w.player.watch)
  const evs = fresh.map((id) => eventById(w, id)).filter((e): e is HistEvent => !!e && (e.imp >= minImp || (f != null && e.who.includes(f.id) && e.imp >= 1) || e.who.some((id) => w.people[id]?.owned || watch.has(id) && e.imp >= 1)))
  const ticker = evs.slice(-30).map((e) => lite(w, e))
  return {
    t: w.t, date: dateStr(w.epoch, w.t), dateShort: shortDate(w.epoch, w.t), alive: dots.length, follow: w.player.follow,
    influence: Math.floor(w.player.influence), influenceMax: t.max, tier: w.player.tier,
    crossroads: w.player.crossroads.filter((c) => !c.chosen && c.expires > w.t).length,
    dots, hazards, fronts, ticker, names: names(w, ticker.map((e) => e.text), [w.player.follow]),
    followLine: f ? `${f.short}: ${f.alive ? (f.trip ? `travelling to ${w.places[f.trip.to].name}` : `${f.act.note || f.act.k} in ${w.places[f.loc].name}`) : 'dead'}` : undefined,
    expeditions: activeRuns(w).length,
  }
}

/* ---------------- The map's static layer ---------------- */

export function placesView(w: World) {
  return w.places.map((p) => ({ id: p.id, key: p.key, name: p.name, x: p.x, y: p.y, kind: p.kind, nation: p.nation, hidden: !!p.hidden, pop: Math.round(p.pop), beyond: p.kind === 'beyond', known: p.kind !== 'beyond' || (w.expeditions || []).some((x) => x.region === p.key || x.goal === p.key && x.stage !== 'gathering') }))
}

/* ---------------- A person ---------------- */

export function personView(w: World, id: Id) {
  const p = w.people[id]
  if (!p) return null
  const texts: string[] = []
  const rels = Object.entries(p.rel)
    .map(([k, r]) => ({ id: +k, ...r, bonds: bondsOf(r) as Bond[] }))
    .filter((r) => w.people[r.id])
    .sort((a, b) => (b.bonds.length ? 200 : 0) + Math.abs(b.aff) + b.fam / 2 - (a.bonds.length ? 200 : 0) - Math.abs(a.aff) - a.fam / 2)
    .slice(0, 40)
    .map((r) => ({ id: r.id, aff: Math.round(r.aff), trust: Math.round(r.trust), resp: Math.round(r.resp), fear: Math.round(r.fear), attr: Math.round(r.attr), fam: Math.round(r.fam), bonds: r.bonds.map((b) => BOND_LABEL[b]), theirs: Math.round(w.people[r.id].rel[p.id]?.aff ?? 0) }))
  const life = p.life.map((eid) => eventById(w, eid)).filter((e): e is HistEvent => !!e).slice(-80).reverse().map((e) => lite(w, e))
  for (const e of life) texts.push(e.text)
  const pl = w.places[p.loc]
  const hatsu = p.nen.hatsu.concat(p.nen.stolen).map((h) => ({
    id: h.id, name: h.name, desc: h.desc, cats: catLine(h), stolen: h.from != null, from: h.from, stars: h.stars, uses: h.uses, passive: !!h.passive,
    effects: h.effects.map((e) => EFFECT_LABEL[e.k] + (e.range ? ` (${e.range})` : '')), conds: h.conds.map((c) => ({ text: c.text, stars: c.stars })),
    colors: h.cats.map(([c, wgt]) => ({ c: NEN_COLORS[c], w: wgt })),
  }))
  const known = Object.keys(p.know).length
  const dreams = p.dreams.map((d) => ({ k: d.k, pri: d.pri, prog: Math.round(d.prog), done: d.done != null, failed: d.failed != null, target: d.target, tag: d.tag, label: dreamLabel(w, d) }))
  for (const d of dreams) texts.push(d.label)
  const mem = p.memories.slice().sort((a, b) => b.str - a.str).slice(0, 12).map((m) => ({ text: m.text, val: m.val, str: Math.round(m.str), t: shortDate(w.epoch, m.t) }))
  const orgs = p.orgs.map((m) => ({ id: m.org, name: w.orgs[m.org].name, color: w.orgs[m.org].color, rank: w.orgs[m.org].ranks[m.rank] || '', title: m.title, num: m.num, secret: m.secret }))
  const items = p.items.map((i) => w.items[i]).filter(Boolean).map((it) => ({ id: it.id, name: it.name, k: it.k, value: it.value }))
  const nm = names(w, texts, rels.map((r) => r.id))
  return {
    id: p.id, name: p.name, short: p.short, sex: p.sex, species: p.species, alive: p.alive, age: age(w, p), born: dateStr(w.epoch, p.born),
    death: p.death ? { date: dateStr(w.epoch, p.death.t), cause: p.death.cause, by: p.death.by } : null,
    role: ROLES[p.role]?.n || p.role, title: p.title, canon: p.canon, major: p.major, owned: !!p.owned, followed: w.player.follow === p.id, watched: w.player.watch.includes(p.id), bio: p.bio,
    nation: w.nations[p.nation]?.name, home: w.places[p.home]?.name, at: pl ? { id: pl.id, name: pl.name } : null,
    trip: p.trip ? { to: w.places[p.trip.to].name, days: Math.max(0, p.trip.t1 - w.t) } : null,
    doing: p.act.note || p.act.k, plan: p.plan ? p.plan.why || p.plan.k : null,
    hp: Math.max(0, Math.round(p.hp)), hpMax: hpMax(p), stam: Math.round(p.stam), power: Math.round(power(p)),
    jenny: Math.round(p.jenny * 10) / 10, fame: Math.round(p.fame), infamy: Math.round(p.infamy), bounty: Math.round(p.bounty),
    license: p.license ? { stars: p.license.stars, since: shortDate(w.epoch, p.license.t), field: p.license.field } : null,
    stats: p.stats,
    wounds: p.wounds.filter((x) => x.left > 0 || x.perm).map((x) => ({ part: x.part, sev: x.sev, perm: x.perm, bleed: x.bleed, left: Math.round(x.left) })),
    conds: p.conds.map((c) => ({ k: c.k, note: c.note, left: c.until < 0 ? -1 : c.until - w.t })),
    needs: NEEDS.map((n) => ({ k: n, v: Math.round(p.needs[n]), w: Math.round(p.needW[n] * 100) / 100 })),
    mood: { happy: Math.round(p.mood.happy), stress: Math.round(p.mood.stress), fear: Math.round(p.mood.fear), anger: Math.round(p.mood.anger), grief: Math.round(p.mood.grief) },
    facets: FACETS.map((k) => ({ k, v: Math.round(p.facets[k]) })),
    values: VALUES.map((k) => ({ k, v: Math.round(p.values[k]) })),
    attrs: p.attrs, mind: p.mind,
    skills: SKILLS.map((k) => ({ k, v: Math.round(p.skills[k]) })).filter((s) => s.v > 15).sort((a, b) => b.v - a.v),
    nen: {
      awake: p.nen.awake, known: p.nen.known, type: p.nen.known || p.nen.awake ? NEN_TYPES[p.nen.type] : null, color: NEN_COLORS[p.nen.type], typeIdx: p.nen.type,
      lvl: Math.round(p.nen.lvl * 10) / 10, cap: Math.round(p.nen.cap), pot: Math.round(p.nen.pot * 100) / 100, aura: Math.round(auraMax(p) * p.nen.aura), auraMax: auraMax(p),
      tech: TECHS.map((t) => ({ k: t, v: Math.round(p.nen.tech[t] || 0) })), cat: p.nen.cat.map((v) => Math.round(v)),
      hatsu, vows: p.nen.vows.map((v) => ({ text: v.text, stars: v.stars, person: v.person, org: v.org })), lifeSpent: p.nen.lifeSpent, burnedOut: !!p.nen.burnedOut,
    },
    dreams, memories: mem, rels, orgs, items, known, life, names: nm,
    weapon: p.weapon,
  }
}

function dreamLabel(w: World, d: Person['dreams'][number]): string {
  const t = d.target != null ? (d.k === 'serve' || d.tag === 'org' ? `{o${d.target}}` : d.target >= 0 && w.people[d.target] ? `{p${d.target}}` : '') : ''
  switch (d.k) {
    case 'hunter': return 'Become a Hunter'
    case 'find': return `Find ${t}`
    case 'avenge': return d.tag === 'org' ? `Destroy ${t}` : t ? `Avenge themselves on ${t}` : 'Find out who did it'
    case 'recover': return d.tag === 'scarlet_eyes' ? 'Recover every pair of Scarlet Eyes' : d.tag === 'hope' ? 'Own a hope from the Dark Continent' : `Recover the ${d.tag}`
    case 'strongest': return 'Become the strongest'
    case 'defeat': return `Beat ${t}`
    case 'doctor': return 'Become a doctor'
    case 'protect': return t ? `Protect ${t}` : 'Protect the weak'
    case 'rule': return t ? `Rule ${t}` : 'Rule'
    case 'wealth': return 'Get rich'
    case 'explore': return 'Go beyond the edge of the world'
    case 'family': return 'Have a family'
    case 'serve': return `Serve ${t}`
    case 'clear': return 'Clear Greed Island'
    case 'discover': return `Discover something new (${d.tag})`
    case 'peace': return 'Find peace'
    case 'chaos': return 'Find someone worth fighting'
    case 'free': return t && d.target !== undefined ? `Free ${t}` : 'Be free'
    case 'master': return d.tag === 'ura' ? 'Learn Nen (the hidden exam)' : 'Master Nen'
    case 'fame': return 'Be famous'
    default: return d.k
  }
}

/* ---------------- Chronicle ---------------- */

export function chronicleView(w: World, o: { minImp?: number; who?: Id; at?: Id; type?: string; before?: Id; limit?: number }) {
  const out: EventLite[] = []
  const lim = o.limit ?? 120
  for (let i = w.events.length - 1; i >= 0 && out.length < lim; i--) {
    const e = w.events[i]
    if (o.before != null && e.id >= o.before) continue
    if (o.who != null && !e.who.includes(o.who)) continue
    if (o.at != null && e.at !== o.at) continue
    if (o.type && e.type !== o.type) continue
    if (e.imp < (o.minImp ?? 3) && !(o.who != null && e.imp >= 1)) continue
    out.push(lite(w, e))
  }
  return { events: out, names: names(w, out.map((e) => e.text)) }
}

/** One event with the chain of causes behind it, and its fight if it was one. */
export function eventView(w: World, id: Id) {
  const e = eventById(w, id)
  if (!e) return null
  const chain: EventLite[] = []
  let c = eventById(w, e.cause)
  const seen = new Set<Id>()
  while (c && chain.length < 12 && !seen.has(c.id)) { seen.add(c.id); chain.push(lite(w, c)); c = eventById(w, c.cause) }
  const after = w.events.filter((x) => x.cause === id).slice(0, 12).map((x) => lite(w, x))
  const fight = (e.data as { fight?: unknown } | undefined)?.fight ?? null
  const all = [lite(w, e), ...chain, ...after]
  const extra: Id[] = []
  if (fight && typeof fight === 'object') for (const id of ((fight as { people?: Id[] }).people || [])) if (id >= 0) extra.push(id)
  return { event: lite(w, e), chain, after, fight, names: names(w, all.map((x) => x.text).concat(JSON.stringify(fight || '')), extra) }
}

/* ---------------- Places, nations, organisations ---------------- */

export function placeView(w: World, id: Id) {
  const pl = w.places[id]
  if (!pl) return null
  const here = at(w, id).slice().sort((a, b) => b.fame - a.fame)
  const ev = chronicleView(w, { at: id, minImp: 2, limit: 40 })
  return {
    id, name: pl.name, kind: pl.kind, region: pl.region, desc: pl.desc, nation: w.nations[pl.nation]?.name, nationId: pl.nation,
    pop: Math.round(pl.pop), wealth: Math.round(pl.wealth * 100), danger: Math.round(pl.danger * 100), unrest: Math.round(pl.unrest * 100), hospital: pl.hospital,
    features: pl.features, base: pl.base ? { pop: Math.round(pl.base.pop) } : null,
    hazards: (pl.hazards || []).map((h) => ({ k: h.k, name: HAZARDS[h.k].name, sev: Math.round(h.sev * 100), color: HAZARDS[h.k].color, since: shortDate(w.epoch, h.t), help: HAZARDS[h.k].help })),
    people: here.slice(0, 60).map((p) => ({ id: p.id, doing: p.act.note || p.act.k })), count: here.length,
    events: ev.events, names: { ...ev.names, p: { ...ev.names.p, ...names(w, [], here.slice(0, 60).map((p) => p.id)).p } },
  }
}

export function nationView(w: World, id: Id) {
  const n = w.nations[id]
  if (!n) return null
  const ev = chronicleView(w, { minImp: 3, limit: 400 })
  const mine = ev.events.filter((e) => e.text.includes(`{n${id}}`)).slice(0, 30)
  const ruler = w.people[n.ruler]
  return {
    id, name: n.name, gov: n.gov, ruler: ruler ? ruler.id : null, rulerTitle: n.rulerTitle, capital: w.places[n.capital]?.name, color: n.color, desc: n.desc,
    pop: n.pop, gdp: Math.round(n.gdp * 10) / 10, treasury: Math.round(n.treasury), tech: Math.round(n.tech), stability: Math.round(n.stability), traits: n.traits,
    mil: { troops: Math.round(n.mil.troops), armor: Math.round(n.mil.armor), air: Math.round(n.mil.air), navy: Math.round(n.mil.navy), readiness: Math.round(n.mil.readiness), morale: Math.round(n.mil.morale) },
    arsenal: n.arsenal, blocs: n.blocs,
    rel: Object.entries(n.rel).map(([k, r]) => ({ id: +k, name: w.nations[+k]?.name, op: Math.round(r.op), war: w.wars.some((x) => x.end == null && (x.a.includes(id) && x.d.includes(+k) || x.d.includes(id) && x.a.includes(+k))) })).sort((a, b) => a.op - b.op),
    wars: w.wars.filter((x) => !x.factions && (x.a.includes(id) || x.d.includes(id))).map((x) => ({ id: x.id, name: x.name, goal: x.goal, start: shortDate(w.epoch, x.start), end: x.end != null ? shortDate(w.epoch, x.end) : null, score: Math.round(x.score), outcome: x.outcome, dead: x.dead, civ: Math.round(x.civ) })),
    hopes: w.items.filter((it) => it.k === 'hope' && it.holder < 0 && it.place === n.capital).map((it) => it.name),
    events: mine, names: { ...names(w, mine.map((e) => e.text), ruler ? [ruler.id] : []) },
  }
}

export function orgView(w: World, id: Id) {
  const o = w.orgs[id]
  if (!o) return null
  const ms = members(w, id).slice().sort((a, b) => (b.orgs.find((m) => m.org === id)?.rank ?? 0) - (a.orgs.find((m) => m.org === id)?.rank ?? 0) || b.fame - a.fame)
  const log = o.rulesLog.slice(-30).reverse().map((r) => ({ t: shortDate(w.epoch, r.t), rule: r.rule, who: r.who, outcome: r.outcome, ev: r.ev }))
  return {
    id, name: o.name, short: o.short, kind: o.kind, color: o.color, desc: o.desc, leader: o.leader, hq: w.places[o.hq]?.name, treasury: Math.round(o.treasury), rep: Math.round(o.rep), dead: !!o.dead,
    rules: o.rules, rulesLog: log, ranks: o.ranks, seats: o.seats,
    members: ms.slice(0, 80).map((p) => { const m = p.orgs.find((x) => x.org === id)!; return { id: p.id, rank: o.ranks[m.rank] || '', title: m.title, num: m.num, secret: m.secret } }),
    count: ms.length,
    names: names(w, log.map((l) => l.outcome), ms.slice(0, 80).map((p) => p.id).concat(o.leader >= 0 ? [o.leader] : []).concat(log.map((l) => l.who))),
  }
}

export function worldView(w: World) {
  const stories = w.stories.filter((s) => s.status === 'active').sort((a, b) => b.heat - a.heat).slice(0, 20).map((s) => ({ id: s.id, k: s.k, title: s.title, who: s.who.slice(0, 6), since: shortDate(w.epoch, s.t0), heat: Math.round(s.heat), n: s.ev.length }))
  const wars = w.wars.filter((x) => x.end == null).map((x) => ({ id: x.id, name: x.name, goal: x.goal, score: Math.round(x.score), dead: x.dead, start: shortDate(w.epoch, x.start) }))
  const disasters = w.places.filter((p) => p.hazards?.length).map((p) => ({ id: p.id, name: p.name, hazards: p.hazards!.map((h) => ({ k: h.k, label: HAZARDS[h.k].label, sev: Math.round(h.sev * 100), color: HAZARDS[h.k].color })) }))
  return {
    nations: w.nations.filter((n) => n.key !== 'none' && n.key !== 'free').map((n) => ({ id: n.id, name: n.name, color: n.color, ruler: n.ruler, stability: Math.round(n.stability), blocs: n.blocs, atWar: w.wars.some((x) => x.end == null && (x.a.includes(n.id) || x.d.includes(n.id))) })),
    orgs: w.orgs.filter((o) => !o.dead).map((o) => ({ id: o.id, name: o.name, color: o.color, kind: o.kind, count: members(w, o.id).length, leader: o.leader })),
    stories, wars, disasters,
    names: names(w, [], stories.flatMap((s) => s.who).concat(w.nations.map((n) => n.ruler).filter((x) => x >= 0)).concat(w.orgs.map((o) => o.leader).filter((x) => x >= 0))),
  }
}

/* ---------------- Beyond the lake ---------------- */

export function beyondView(w: World) {
  const dc = w.dc
  if (!dc) return null
  const knownBy = (k: string) => { const f = dc.facts[k]; if (f == null) return 0; let n = 0; for (const p of alive(w)) if (p.know[f] != null) n++; return n }
  const fact = (k: string) => w.facts.find((f) => f.id === dc.facts[k])
  const cal = dc.calamities.map((c) => {
    const f = fact(c.key)
    const known = !!f
    return {
      key: c.key, known, public: f ? f.secret < 0 : false, canon: c.canon, knownBy: knownBy(c.key),
      name: known ? c.name : '???', title: known ? c.title : 'unrecorded', threat: known ? c.threat : '?', desc: known ? c.desc : 'Nobody inside the lake has seen it and lived.',
      region: dc.regions.find((r) => r.key === c.region)?.name ?? '?', regionKey: c.region, hope: known ? c.hope.name : '?', hopeDesc: known ? c.hope.desc : '', brought: dc.hopes[c.hope.key] || 0,
    }
  })
  const runs = (w.expeditions || []).slice().reverse().slice(0, 40).map((x) => ({
    id: x.id, name: x.name, leader: x.leader, stage: x.stage, legal: x.legal, members: x.members, dead: x.dead.length, weeks: x.weeks,
    supplies: Math.round(x.supplies * 100), morale: Math.round(x.morale), region: x.region ? dc.regions.find((r) => r.key === x.region)?.name : null, regionKey: x.region ?? null, goalKey: x.goal ?? null,
    goal: x.goal ? dc.regions.find((r) => r.key === x.goal)?.name : null, found: x.found.map((k) => dc.calamities.find((c) => c.hope.key === k)?.hope.name), met: x.met.map((k) => dc.calamities.find((c) => c.key === k)?.name),
    end: x.end ?? null, endDate: x.endT != null ? shortDate(w.epoch, x.endT) : null, since: shortDate(w.epoch, x.t0),
  }))
  const hopes = w.items.filter((it) => it.k === 'hope').map((it) => ({ id: it.id, name: it.name, holder: it.holder, place: it.place != null ? w.places[it.place]?.name : null, uses: (it.data as { uses?: number })?.uses ?? 0 }))
  const castaways = alive(w).filter((p) => p.flags.castaway).map((p) => p.id)
  return { calamities: cal, runs, hopes, castaways, attempts: dc.attempts, returned: dc.returned, names: names(w, runs.map((r) => r.end || ''), runs.flatMap((r) => r.members).concat(hopes.map((h) => h.holder).filter((x) => x >= 0)).concat(castaways)) }
}

/* ---------------- Legends ---------------- */

export function legendsView(w: World) {
  const ppl = w.people.filter((p) => p.canon || p.fame > 25 || p.owned)
  const famous = ppl.filter((p) => p.alive).sort((a, b) => b.fame - a.fame).slice(0, 25).map((p) => p.id)
  const strongest = alive(w).filter((p) => p.species === 'human').sort((a, b) => power(b) - power(a)).slice(0, 20).map((p) => ({ id: p.id, power: Math.round(power(p)), lvl: Math.round(p.nen.lvl) }))
  const killers = w.people.filter((p) => p.stats.kills > 0).sort((a, b) => b.stats.kills - a.stats.kills).slice(0, 15).map((p) => ({ id: p.id, kills: p.stats.kills }))
  const dead = w.people.filter((p) => !p.alive && (p.canon || p.fame > 30 || p.owned)).sort((a, b) => (b.death?.t ?? 0) - (a.death?.t ?? 0)).slice(0, 60).map((p) => ({ id: p.id, date: shortDate(w.epoch, p.death!.t), cause: p.death!.cause }))
  const great = w.events.filter((e) => e.imp >= 5).slice(-80).reverse().map((e) => lite(w, e))
  const ended = w.stories.filter((s) => s.status === 'resolved').slice(-30).reverse().map((s) => ({ id: s.id, title: s.title, outcome: s.outcome, from: shortDate(w.epoch, s.t0), to: s.t1 != null ? shortDate(w.epoch, s.t1) : '' }))
  return { famous, strongest, killers, dead, great, ended, names: names(w, great.map((e) => e.text), famous.concat(strongest.map((s) => s.id), killers.map((k) => k.id), dead.map((d) => d.id))) }
}

/* ---------------- A storyline ---------------- */

export function storyView(w: World, id: Id) {
  const st = w.stories.find((s) => s.id === id)
  if (!st) return null
  const events = st.ev.map((eid) => eventById(w, eid)).filter((e): e is HistEvent => !!e).map((e) => lite(w, e))
  // Consequences recorded after the story's own events, by cause.
  const ids = new Set(st.ev)
  const after = w.events.filter((e) => e.cause != null && ids.has(e.cause) && !ids.has(e.id) && e.imp >= 2).slice(0, 30).map((e) => lite(w, e))
  const all = events.concat(after).sort((a, b) => a.t - b.t || a.id - b.id)
  return { id, title: st.title, k: st.k, status: st.status, outcome: st.outcome, from: shortDate(w.epoch, st.t0), to: st.t1 != null ? shortDate(w.epoch, st.t1) : null, who: st.who, events: all, names: names(w, all.map((e) => e.text), st.who) }
}

/* ---------------- Search, player ---------------- */

export function searchView(w: World, q: string) {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const out: { id: Id; name: string; alive: boolean; role: string; c?: string; canon: boolean }[] = []
  for (const p of w.people) {
    if (!p.name.toLowerCase().includes(s)) continue
    out.push({ id: p.id, name: p.name, alive: p.alive, role: ROLES[p.role]?.n || p.role, c: p.nen.awake ? NEN_COLORS[p.nen.type] : undefined, canon: p.canon })
    if (out.length >= 30) break
  }
  return out.sort((a, b) => Number(b.canon) - Number(a.canon) || Number(b.alive) - Number(a.alive))
}

export function castView(w: World) {
  return w.people.filter((p) => p.canon && p.alive && p.species === 'human').sort((a, b) => Number(b.major) - Number(a.major) || b.fame - a.fame)
    .map((p) => ({ id: p.id, name: p.name, short: p.short, major: p.major, role: ROLES[p.role]?.n || p.role, c: NEN_COLORS[p.nen.type], type: NEN_TYPES[p.nen.type], at: w.places[p.loc]?.name, age: age(w, p), bio: p.bio, owned: !!p.owned }))
}

export function playerView(w: World) {
  const t = tierInfo(w)
  const cr = w.player.crossroads.filter((c) => !c.chosen && c.expires > w.t).map((c) => ({ id: c.id, pid: c.pid, title: c.title, prompt: c.prompt, options: c.options, left: c.expires - w.t, forge: !!c.ctx.forge }))
  return {
    tier: w.player.tier, influence: Math.floor(w.player.influence), max: t.max, perDay: t.perDay, owned: w.player.owned, ownedMax: t.owned, forgeSlots: t.forgeSlots,
    crossroads: cr, fateCost: FATE_COST, follow: w.player.follow, watch: w.player.watch,
    names: names(w, cr.map((c) => c.prompt), w.player.owned.concat(cr.map((c) => c.pid))),
  }
}

export function placeName(w: World, p: Place) { return p.name }
