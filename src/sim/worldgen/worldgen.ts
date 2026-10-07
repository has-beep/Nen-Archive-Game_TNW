/**
 * Building a world: the lore map, nations, organisations, the canon cast as
 * they stand in December 1998, and a few hundred more people who are not in
 * the series but live in the same world: Hunters, mafiosi, soldiers, masters,
 * arena fighters, thieves, drifters. Then the things already in motion: a
 * Hunter Exam in five weeks, a Troupe with a whim, thirty-six pairs of eyes
 * scattered across the world, and, maybe, a queen drifting across the lake.
 */
import { NATIONS, NATION_OPINION } from '../../data/nations'
import { PLACES } from '../../data/places'
import { ORGS } from '../../data/orgs'
import { CANON_MAIN } from '../../data/canon-main'
import { CANON_MORE } from '../../data/canon-more'
import type { CanonDef } from '../../data/canon-types'
import type { Laws, Nation, Org, Person, Place, World } from '../types'
import { Rng } from '../rng'
import { epochOf, tickOf } from '../time'
import { alive, members, nationK, orgK, personK, placeK, reindex, rng, touch } from '../world'
import { buildCanon, linkCanon, familyTies } from './canon'
import { spawn } from './spawn'
import { change, setBond, isKin } from '../people/relations'
import { develop } from '../nen/nen'
import { log } from '../history'
import { makeItem } from '../society/economy'
import { announceExam } from '../society/calendar'
import { initDarkContinent } from '../society/expeditions'
import { seedDreams } from '../people/dreams'

export interface WorldOptions {
  seed: number
  laws?: Partial<Laws>
  /** Extra generated people, on top of the canon cast. */
  population?: number
  /** Whether the Chimera Ant queen may come: 'random' (seed decides), 'yes', 'no'. */
  ants?: 'random' | 'yes' | 'no'
  tier?: string
  /** Archive characters (from the Nen Archive) to add as minor canon. */
  archive?: CanonDef[]
}

export const DEFAULT_LAWS: Laws = { lethality: 0.5, vowPower: 1, growth: 1, healing: 1, postmortem: true, wars: true, plotArmor: false, romance: true, calamities: true, disasters: true, expeditions: true }

export function createWorld(o: WorldOptions): World {
  const seed = o.seed >>> 0
  const base = Rng.fromSeed(seed)
  const w: World = {
    version: 1, seed, epoch: epochOf(1998, 11, 1), t: 0, rng: base.s, era: '1998',
    people: [], places: [], nations: [], orgs: [], parties: [], wars: [], facts: [], items: [], contracts: [], events: [], nextEv: 1,
    stories: [], laws: { ...DEFAULT_LAWS, ...(o.laws || {}) }, flags: {}, counters: { examNo: 286 }, fresh: [], nextFact: 1, nextItem: 0,
    player: { owned: [], follow: 0, watch: [], influence: 10, tier: o.tier || 'free', crossroads: [], log: [], settings: { pause: true, autoChoose: false }, nextId: 1, hunterPoints: 0, predictions: [] },
  }
  // Nations, places, organisations.
  NATIONS.forEach((d, i) => {
    const n: Nation = {
      id: i, key: d.key, name: d.name, short: d.short, gov: d.gov, ruler: -1, rulerTitle: d.rulerTitle, capital: -1, pop: d.pop, gdp: d.gdp,
      treasury: d.gdp * 20, tech: d.tech, stability: d.stability, traits: { ...d.traits }, mil: { ...d.mil, readiness: 40, morale: 60, nen: [] },
      arsenal: { ...d.arsenal }, rel: {}, blocs: d.blocs.slice(), color: d.color, weariness: 0, flags: {}, desc: d.desc,
    }
    w.nations.push(n)
  })
  const nk = (k: string) => w.nations.find((n) => n.key === k)!.id
  PLACES.forEach((d, i) => {
    const pl: Place = {
      id: i, key: d.key, name: d.name, nation: nk(d.nation), x: d.x, y: d.y, kind: d.kind, pop: d.pop, danger: d.danger, wealth: d.wealth,
      airport: !!d.airport, port: !!d.port, hospital: d.hospital ?? 0, features: d.features || [], hazard: 0, hazardUntil: 0, unrest: 0, hidden: d.hidden, region: d.region, desc: d.desc,
    }
    w.places.push(pl)
  })
  for (const n of w.nations) {
    const d = NATIONS.find((x) => x.key === n.key)!
    n.capital = w.places.find((p) => p.key === d.capital)?.id ?? -1
  }
  for (const [a, b, v] of NATION_OPINION) {
    const A = w.nations[nk(a)], B = w.nations[nk(b)]
    A.rel[B.id] = { op: v, ally: false, nap: false, trade: v > 20, sanction: false }
    B.rel[A.id] = { op: v, ally: false, nap: false, trade: v > 20, sanction: false }
  }
  // V5 members are allies.
  for (const a of w.nations) for (const b of w.nations) if (a !== b && a.blocs.includes('V5') && b.blocs.includes('V5')) { a.rel[b.id] = { ...(a.rel[b.id] || { op: 40, nap: true, trade: true, sanction: false }), ally: true, nap: true, trade: true, op: Math.max(30, a.rel[b.id]?.op ?? 30), sanction: false } }
  ORGS.forEach((d, i) => {
    const org: Org = {
      id: i, key: d.key, name: d.name, short: d.short, kind: d.kind, leader: -1, hq: w.places.find((p) => p.key === d.hq)!.id, nation: nk(d.nation),
      color: d.color, ranks: d.ranks, treasury: d.treasury, rep: 50, rules: d.rules, ops: [], tension: {}, founded: -3650, dead: d.dead, secret: d.secret,
      flags: {}, rulesLog: [], desc: d.desc, seats: d.seats,
    }
    w.orgs.push(org)
  })
  reindex(w)
  const r = rng(w)

  // The canon cast.
  const canon = [...CANON_MAIN, ...CANON_MORE, ...(o.archive || [])].filter((d) => !d.appears)
  const seen = new Set<string>()
  for (const d of canon) { if (seen.has(d.key)) continue; seen.add(d.key); buildCanon(w, d) }
  for (const p of w.people.slice()) linkCanon(w, p)
  familyTies(w)
  // Leaders.
  const lead = (org: string, key: string) => { const p = personK(w, key); if (p) orgK(w, org).leader = p.id }
  lead('ha', 'netero'); lead('troupe', 'chrollo_lucilfer'); lead('zoldyck', 'silva_zoldyck'); lead('nostrade', 'light_nostrade')
  lead('kakin_royal', 'nasubi_hui_guo_rou'); lead('kakin_army', 'benjamin_hui_guo_rou'); lead('gi_masters', 'ging_freecss'); lead('bombers', 'genthru')
  lead('shingen', 'netero'); lead('gorteau_regime', 'ming_jol_ik'); lead('zodiacs', 'pariston_hill')
  const kakin = nationK(w, 'kakin'), eg = nationK(w, 'egorteau')
  kakin.ruler = personK(w, 'nasubi_hui_guo_rou')!.id
  eg.ruler = personK(w, 'ming_jol_ik')!.id
  // Special canon conditions.
  const ging = personK(w, 'ging_freecss'); if (ging) ging.flags.elusive = 0.97
  // Greed Island has been running for twelve years. Some teams are close.
  for (const [k, prog] of [['tsezguerra', 74], ['genthru', 76], ['goreinu', 40]] as const) {
    const d = personK(w, k)?.dreams.find((x) => x.k === 'clear')
    if (d) d.prog = prog
  }
  const killua = personK(w, 'killua_zoldyck'); if (killua) killua.flags.illumiNeedle = 1
  const alluka = personK(w, 'alluka_zoldyck'); if (alluka) alluka.flags.confined = 1
  const hisoka = personK(w, 'hisoka_morow'); if (hisoka) { const m = hisoka.orgs.find((x) => w.orgs[x.org].key === 'troupe'); if (m) m.secret = false; hisoka.flags.fakeSpider = 1 }

  // The generated population.
  populate(w, r, o.population ?? 240)
  backstories(w, r)
  scarletEyes(w, r)

  for (const p of alive(w)) if (p.nen.awake && p.nen.lvl >= 34 && !p.nen.hatsu.length && !p.nen.destined?.length && p.species === 'human') develop(w, p, { quiet: true })
  silentBonds(w)
  // The Dark Continent: five known calamities, and some nobody knows about.
  initDarkContinent(w)
  reindex(w)
  // Things already in motion.
  announceExam(w, 1999)
  if (o.ants !== 'no' && (o.ants === 'yes' || r.chance(0.75))) w.flags.antQueenDay = 330 + r.int(330)
  for (const p of alive(w)) { if (!p.dreams.length) seedDreams(w, p); p.nextThink = r.int(3) }
  // The player follows Gon by default.
  w.player.follow = personK(w, 'gon_freecss')?.id ?? 0
  // World generation should not appear in the chronicle; start it clean.
  w.events = []
  w.nextEv = 1
  for (const p of w.people) { p.life = []; p.memories = p.memories.filter((m) => m.str > 50) }
  w.fresh = []
  log(w, { type: 'misc', imp: 3, text: `The world begins on 1 December 1998. ${alive(w).length} people of note, ${w.places.length} places, ${w.nations.length - 2} nations. The 287th Hunter Exam is five weeks away. World seed ${seed}.` })
  touch(w)
  return w
}

/* ================= Population ================= */

function populate(w: World, r: Rng, n: number) {
  const P = (k: string) => placeK(w, k).id
  const scale = n / 240
  const many = (count: number, f: (i: number) => void) => { for (let i = 0; i < Math.round(count * scale); i++) f(i) }
  const ha = orgK(w, 'ha'), mafia = orgK(w, 'mafia'), zol = orgK(w, 'zoldyck'), army = orgK(w, 'kakin_army'), arena = orgK(w, 'arena'), regime = orgK(w, 'gorteau_regime'), royal = orgK(w, 'kakin_royal')
  const join = (p: Person, org: Org, rank = 0, title?: string) => p.orgs.push({ org: org.id, rank, t: -300, loyalty: 50 + r.int(40), title })
  const cities = w.places.filter((p) => p.kind === 'city' && !p.hidden)
  // Hunters, in every field.
  const fields = ['blacklist', 'blacklist', 'treasure', 'gourmet', 'beast', 'ruins', 'sea', 'jackpot', 'virus', 'crime', 'info', 'contract', 'blacklist', 'beast']
  many(48, (i) => {
    const role = fields[i % fields.length]
    const p = spawn(w, { role, place: r.chance(0.35) ? P('swardani') : r.pick(cities).id, lvl: [36, 76], age: [20, 58], bias: { ambition: 8, curiosity: 8 }, jenny: 20 + r.int(200) })
    p.license = { t: -365 * (1 + r.int(15)), stars: p.nen.lvl > 66 && r.chance(0.4) ? 1 : p.nen.lvl > 72 && r.chance(0.15) ? 2 : 0, field: role }
    p.fame = 5 + p.nen.lvl / 4 + p.license.stars * 15
    join(p, ha)
    if (/gourmet|beast|ruins|sea|treasure|virus/.test(role)) p.dreams.push({ k: 'discover', pri: 60, prog: 0, since: 0, tag: role === 'treasure' ? 'ruins' : role === 'beast' ? 'beasts' : role })
  })
  // The Mafia: the Ten Dons and their families.
  const yk = P('yorknew')
  const dons: Person[] = []
  many(10, () => {
    const p = spawn(w, { role: 'don', place: r.chance(0.7) ? yk : r.pick(cities).id, lvl: [0, 20], awake: false, age: [45, 75], bias: { greed: 20, ambition: 15, cruelty: 10 }, vbias: { wealth: 25, power: 20, law: -25 }, jenny: 500 + r.int(3000) })
    join(p, mafia, 3, 'Don')
    dons.push(p)
  })
  if (dons.length) mafia.leader = dons.sort((a, b) => b.jenny - a.jenny)[0].id
  many(26, () => {
    const p = spawn(w, { role: 'mafioso', place: r.chance(0.75) ? yk : r.pick(cities).id, lvl: [0, 40], age: [20, 50], bias: { cruelty: 10, loyalty: 10 }, vbias: { law: -20, wealth: 15 } })
    join(p, mafia, r.chance(0.2) ? 1 : 0)
    if (dons.length) { const d = r.pick(dons); setBond(w, p, d, 'employer'); change(w, p, d, { aff: 25, trust: 20, fam: 30 }) }
  })
  // The Shadow Beasts: the Ten Dons' Nen-using guards.
  const beasts = ['Owl', 'Leech', 'Gyoru', 'Hokkaiko', 'Uborogi', 'Tocino', 'Pakuto', 'Sakki']
  many(8, (i) => {
    const p = spawn(w, { role: 'guard', place: yk, lvl: [52, 68], age: [25, 50], bias: { cruelty: 15, loyalty: 15, bravery: 10 }, vbias: { law: -20 }, name: `${beasts[i % beasts.length]} ${r.pick(['Shadow', 'of the Ten Dons'])}`.replace(' Shadow', '').trim() })
    join(p, mafia, 1, 'Shadow Beast')
    p.title = 'Shadow Beast'
  })
  // Zoldyck butlers.
  many(6, () => { const p = spawn(w, { role: 'butler', place: P('kukuroo'), lvl: [30, 55], age: [18, 50], bias: { loyalty: 25, discipline: 20 } }); join(p, zol, 0, 'Butler') })
  // Kakin's army and royal guards.
  many(16, (i) => {
    const p = spawn(w, { role: i < 5 ? 'officer' : 'soldier', place: r.chance(0.8) ? P('kakin') : P('kakinport'), lvl: [i < 8 ? 40 : 20, i < 8 ? 66 : 48], age: [22, 45], bias: { discipline: 20, loyalty: 15 }, vbias: { tradition: 15 } })
    join(p, army, i < 5 ? 1 : 0)
    if (r.chance(0.5)) join(p, royal, 0, 'Royal Guard')
  })
  // East Gorteau's regime.
  many(6, () => { const p = spawn(w, { role: 'officer', place: P('peijin'), lvl: [10, 40], age: [25, 55], bias: { cruelty: 15, loyalty: 10 } }); join(p, regime, 1) })
  // Heads of state the series never named.
  for (const n of w.nations) {
    if (n.ruler >= 0 || n.gov === 'stateless' || n.capital < 0 || n.key === 'free') continue
    const p = spawn(w, { role: 'ruler', place: n.capital, nation: n.id, lvl: [0, 10], awake: false, age: [45, 70], bias: { ambition: 15 }, vbias: { power: 15 }, jenny: 200 + r.int(500) })
    p.title = n.rulerTitle
    n.ruler = p.id
  }
  // National officers for the great powers, so wars have faces.
  for (const k of ['saherta', 'ochima', 'begerosse', 'mimbo', 'kukanyu']) {
    const n = nationK(w, k)
    many(3, () => spawn(w, { role: 'officer', place: n.capital, nation: n.id, lvl: [15, 55], age: [25, 55], bias: { discipline: 15 } }))
  }
  // Heavens Arena.
  many(16, () => {
    const p = spawn(w, { role: 'fighter', place: P('arena'), lvl: [10, 66], age: [16, 40], bias: { aggression: 15, pride: 10 }, vbias: { strength: 20 } })
    p.flags.floor = p.nen.lvl > 45 ? 200 + r.int(40) : 50 + r.int(140)
    if (p.nen.lvl > 45) join(p, arena, 1)
  })
  // Nen masters, doctors, merchants, scholars.
  many(9, () => spawn(w, { role: 'master', place: r.pick([P('mimbo_hills'), P('jappon'), P('arena'), P('zaban'), P('swardani')]), lvl: [55, 80], age: [35, 70], bias: { empathy: 10, discipline: 15 }, vbias: { tradition: 15 } }))
  many(12, () => spawn(w, { role: 'doctor', place: r.pick(cities).id, lvl: [0, 45], age: [26, 60], bias: { empathy: 20 }, vbias: { knowledge: 15, peace: 10 } }))
  many(12, () => spawn(w, { role: 'merchant', place: r.pick(cities).id, lvl: [0, 25], age: [25, 65], bias: { greed: 15 }, vbias: { wealth: 20 }, jenny: 50 + r.int(500) }))
  many(5, () => spawn(w, { role: 'scholar', place: r.pick(cities).id, lvl: [0, 30], age: [25, 70], bias: { curiosity: 20 }, vbias: { knowledge: 25 } }))
  // The other side of the law.
  many(14, () => spawn(w, { role: r.pick(['thief', 'criminal', 'criminal', 'poacher']), place: r.pick(cities.concat([placeK(w, 'meteor')])).id, lvl: [5, 58], age: [18, 45], bias: { honesty: -20, cruelty: 10, greed: 15 }, vbias: { law: -25 } }))
  many(8, () => spawn(w, { role: 'mercenary', place: r.pick(cities).id, lvl: [20, 60], age: [22, 48], bias: { greed: 10, bravery: 10 } }))
  many(8, () => spawn(w, { role: 'drifter', place: P('meteor'), lvl: [0, 40], age: [14, 50], bias: { loyalty: 10, honesty: -5 }, vbias: { law: -15 } }))
  // Greed Island's other players.
  many(10, () => {
    const p = spawn(w, { role: 'gamer', place: P('greed'), lvl: [38, 62], age: [20, 45], bias: { greed: 10, curiosity: 10 } })
    p.flags.giAccess = 1
    p.dreams.unshift({ k: 'clear', pri: 70, prog: 20 + r.int(50), since: 0 })
  })
  // Young people who want to be Hunters, everywhere.
  many(30, () => spawn(w, { role: r.pick(['drifter', 'student', 'civilian']), place: r.pick(w.places.filter((p) => p.kind !== 'beyond' && !p.features.includes('game'))).id, lvl: [0, 22], awake: r.chance(0.05), age: [13, 26], bias: { ambition: 12, curiosity: 12 } }))
  // Ordinary people in every city, for the world to happen to.
  many(20, () => spawn(w, { role: 'civilian', place: r.pick(cities).id, lvl: [0, 10], awake: false, age: [18, 70] }))
  touch(w)
}

/** Old friendships, rivalries and feuds between generated people. */
function backstories(w: World, r: Rng) {
  const pool = r.shuffle(alive(w).filter((p) => !p.canon))
  for (let i = 0; i + 1 < pool.length && i < 120; i += 2) {
    const a = pool[i], b = pool[i + 1]
    const k = r.next()
    if (k < 0.12) {
      change(w, a, b, { aff: -75, trust: -60, fam: 50 }); change(w, b, a, { aff: -75, trust: -60, fam: 50 })
      setBond(w, a, b, 'nemesis')
      a.dreams.push({ k: 'avenge', target: b.id, pri: 40 + r.int(30), prog: 0, since: -500 })
    } else if (k < 0.32) {
      change(w, a, b, { aff: -10, resp: 45, fam: 45 }); change(w, b, a, { aff: -10, resp: 45, fam: 45 })
      setBond(w, a, b, 'rival')
    } else if (k < 0.75) {
      change(w, a, b, { aff: 55, trust: 45, fam: 60 }); change(w, b, a, { aff: 55, trust: 45, fam: 60 })
      setBond(w, a, b, 'friend')
    } else if (a.sex !== b.sex && r.chance(0.5)) {
      const ya = Math.abs(a.born - b.born) / 365
      if (ya < 10 && w.t - a.born > 22 * 365 && w.t - b.born > 22 * 365) {
        change(w, a, b, { aff: 70, trust: 60, fam: 80, attr: 60 }); change(w, b, a, { aff: 70, trust: 60, fam: 80, attr: 60 })
        setBond(w, a, b, 'spouse')
        if (b.loc !== a.loc) b.loc = a.loc
      }
    }
  }
  // Members of the same organisation know each other.
  for (const org of w.orgs) {
    const ms = members(w, org.id)
    if (ms.length > 40) continue
    for (const a of ms) for (const b of ms) {
      if (a === b) continue
      const ra = a.rel[b.id]
      if (!ra) { change(w, a, b, { aff: org.kind === 'gang' || org.kind === 'family' ? 40 : 12, trust: 15, fam: 25 }) }
      setBond(w, a, b, 'comrade')
    }
  }
  touch(w)
}

/** Bonds that the starting feelings already imply, set without fanfare. */
function silentBonds(w: World) {
  for (const a of w.people) for (const k in a.rel) {
    const b = w.people[+k]
    const ra = a.rel[+k], rb = b?.rel[a.id]
    if (!b || !rb || a.id > b.id) continue
    const kin = isKin(a, b.id)
    if (ra.aff >= 42 && rb.aff >= 42 && ra.trust >= 15 && rb.trust >= 15 && !kin) setBond(w, a, b, 'friend')
    if (ra.aff >= 78 && rb.aff >= 78 && ra.trust >= 60 && rb.trust >= 60 && !kin) setBond(w, a, b, 'bestFriend')
  }
}

/** Thirty-six pairs of Scarlet Eyes, scattered across the world's collectors. */
function scarletEyes(w: World, r: Rng) {
  const tserr = personK(w, 'tserriednich_hui_guo_rou')
  const collectors = alive(w).filter((p) => (p.role === 'don' || p.role === 'merchant' || p.role === 'ruler' || p.role === 'prince') && p.jenny > 300)
  const yk = placeK(w, 'yorknew')
  for (let i = 0; i < 36; i++) {
    let holder: Person | null = null
    if (tserr && i < 6) holder = tserr
    else if (i < 30 && collectors.length) holder = r.pick(collectors)
    makeItem(w, 'scarlet_eyes', `pair of Scarlet Eyes (No. ${i + 1})`, holder ? holder.id : -1, 120 + r.int(200), undefined, holder ? undefined : yk.id)
  }
}

export { tickOf, log }
