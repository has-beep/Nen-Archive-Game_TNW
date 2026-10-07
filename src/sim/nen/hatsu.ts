/**
 * Hatsu: a person's own Nen ability, built from parts.
 *
 * An ability is one or more categories (weighted), one or more mechanical
 * effects the fight engine understands, and conditions. Conditions are vows:
 * each carries stars, and stars buy power, exactly as Kurapika's "only on the
 * Troupe, or I die" buys Chain Jail its strength. The Nen Archive's ability
 * builder scores vows the same way (activation, cost, targeting, penalty,
 * frequency), which is what lets a member's saved Ledger ability be brought
 * into the world.
 */
import { NEN_CATS, NEN_TYPES } from '../constants'
import type { NenType } from '../constants'
import type { Effect, EffectKind, Hatsu, HatsuCond, HatsuCondKind, HatsuSpec, Person, World } from '../types'
import type { Rng } from '../rng'
import { eff } from '../people/person'

export function compileSpec(spec: HatsuSpec, owner: Person, t: number): Hatsu {
  const conds = spec.conds || []
  return {
    id: `${owner.id}:${spec.name}`,
    name: spec.name,
    by: owner.id,
    cats: spec.cats,
    kind: spec.kind,
    effects: spec.effects,
    conds,
    stars: Math.min(12, conds.reduce((s, c) => s + c.stars, 0)),
    base: spec.base ?? 1,
    desc: spec.desc,
    t,
    uses: 0,
    passive: spec.passive,
  }
}

/** How much a vow's stars add to an ability. */
export function vowBonus(w: World, stars: number): number {
  return Math.min(0.9, stars * 0.075 * w.laws.vowPower)
}

/** How well this person can use this ability: the categories it draws on,
 *  their own efficiency in each, and how much they have trained them. */
export function catFit(p: Person, h: Hatsu): number {
  let s = 0
  for (const [c, wgt] of h.cats) {
    const e = transformedEff(p, c)
    const mastery = p.nen.cat[c] / 100
    s += wgt * e * (0.55 + 0.45 * mastery)
  }
  return s
}

/** Emperor Time and similar: while transformed, every category is 100%. */
function transformedEff(p: Person, c: NenType): number {
  if (p.flags.emperor && p.nen.type === 3) return 1
  return eff(p, c)
}

/** Overall strength multiplier of an ability in a fight. */
export function hatsuPower(w: World, p: Person, h: Hatsu): number {
  const stolen = h.from != null ? 0.92 : 1
  return catFit(p, h) * h.base * (1 + vowBonus(w, h.stars)) * stolen
}

export function hasCondK(h: Hatsu, k: HatsuCondKind): HatsuCond | undefined {
  return h.conds.find((c) => c.k === k)
}

export function effectOf(h: Hatsu, k: EffectKind): Effect | undefined {
  return h.effects.find((e) => e.k === k)
}

/* ================= Generation ================= */

interface Archetype {
  kind: string
  label: string
  effects: Effect[]
  form: string
  nouns: string[]
}

/** What each category tends to produce. The fight engine only needs the
 *  effects; the form and nouns are flavour that makes each one distinct. */
const ARCH: Record<NenType, Archetype[]> = {
  0: [
    { kind: 'strike', label: 'Strike', effects: [{ k: 'damage', p: 2.0, range: 'melee' }], form: 'pours aura into the body until one blow carries all of it', nouns: ['Hammer', 'Anvil', 'Impact', 'Fist', 'Meteor', 'Breaker', 'Quake'] },
    { kind: 'guard', label: 'Guard', effects: [{ k: 'shield', p: 1.6, dur: 3 }, { k: 'damage', p: 1.1, range: 'melee' }], form: 'hardens the body until blades and bullets slide off', nouns: ['Bulwark', 'Iron', 'Fortress', 'Shell', 'Rampart'] },
    { kind: 'regen', label: 'Regeneration', effects: [{ k: 'heal', p: 1.4 }, { k: 'buff', p: 1.15, dur: 3, stat: 'defense' }], form: 'speeds the body\'s own healing a hundredfold', nouns: ['Heartbeat', 'Ember', 'Pulse', 'Rebirth', 'Marrow'] },
    { kind: 'berserk', label: 'Berserk', effects: [{ k: 'transform', p: 1.45, dur: 4 }], form: 'lets the body run past every limit it has, for a while', nouns: ['Rampage', 'Overdrive', 'Fever', 'Stampede', 'Furnace'] },
  ],
  1: [
    { kind: 'element', label: 'Element', effects: [{ k: 'damage', p: 1.5, range: 'mid' }, { k: 'debuff', p: 0.8, dur: 2, stat: 'speed' }], form: 'turns aura into something with the properties of {element}', nouns: ['Current', 'Frost', 'Ember', 'Static', 'Venom', 'Acid', 'Mist'] },
    { kind: 'elastic', label: 'Binding', effects: [{ k: 'bind', p: 1.4, dur: 2 }, { k: 'damage', p: 1.15, range: 'mid' }], form: 'makes aura cling, stretch and snap back like {material}', nouns: ['Rubber', 'Taffy', 'Thread', 'Resin', 'Silk', 'Gum'] },
    { kind: 'blade', label: 'Blade', effects: [{ k: 'damage', p: 1.55, range: 'melee' }, { k: 'sense', p: 1.1, dur: 2 }], form: 'shapes aura into edges sharper than steel', nouns: ['Razor', 'Scythe', 'Fang', 'Guillotine', 'Edge'] },
    { kind: 'disguise', label: 'Deception', effects: [{ k: 'stealth', p: 1.5 }, { k: 'damage', p: 1.05, range: 'melee' }], form: 'copies any surface or face it touches', nouns: ['Mask', 'Mirage', 'Masquerade', 'Veneer', 'Facade'] },
  ],
  2: [
    { kind: 'chain', label: 'Restraint', effects: [{ k: 'bind', p: 1.8, dur: 3 }, { k: 'seal', p: 0.6, dur: 2 }], form: 'conjures {object} that holds whatever it closes on', nouns: ['Chain', 'Cage', 'Shackle', 'Snare', 'Lock', 'Web'] },
    { kind: 'weapon', label: 'Weapon', effects: [{ k: 'damage', p: 1.6, range: 'melee' }], form: 'conjures {weapon} with a rule of its own built in', nouns: ['Lance', 'Blade', 'Halberd', 'Sickle', 'Hammer'] },
    { kind: 'beast', label: 'Conjured beast', effects: [{ k: 'summon', p: 1.5, dur: 4 }], form: 'conjures {beast} that fights beside its maker', nouns: ['Hound', 'Lantern', 'Familiar', 'Chimera', 'Guardian', 'Wyrm'] },
    { kind: 'room', label: 'Domain', effects: [{ k: 'bind', p: 1.3, dur: 2 }, { k: 'shield', p: 1.3, dur: 3 }], form: 'conjures a room whose walls obey its maker', nouns: ['Hotel', 'Salon', 'Theatre', 'Chapel', 'Parlour'] },
    { kind: 'tool', label: 'Tool', effects: [{ k: 'reveal', p: 1.4 }, { k: 'sense', p: 1.3, dur: 3 }], form: 'conjures {tool} that answers one question truthfully', nouns: ['Compass', 'Lens', 'Ledger', 'Clock', 'Archive'] },
  ],
  3: [
    { kind: 'foresight', label: 'Foresight', effects: [{ k: 'sense', p: 2.0, dur: 4 }, { k: 'speed', p: 1.25, dur: 2 }], form: 'shows the next few seconds before they happen', nouns: ['Prophecy', 'Oracle', 'Almanac', 'Hourglass', 'Omen'] },
    { kind: 'curse', label: 'Curse', effects: [{ k: 'curse', p: 1.6 }, { k: 'debuff', p: 0.75, dur: 4, stat: 'output' }], form: 'lays a rule on its target that punishes disobedience', nouns: ['Verdict', 'Brand', 'Bargain', 'Covenant', 'Toll'] },
    { kind: 'steal', label: 'Theft', effects: [{ k: 'steal', p: 1.2 }, { k: 'damage', p: 1.0, range: 'melee' }], form: 'takes something from its target that does not come back on its own', nouns: ['Vault', 'Key', 'Harvest', 'Collection', 'Ledger'] },
    { kind: 'drain', label: 'Absorption', effects: [{ k: 'drain', p: 1.5 }, { k: 'damage', p: 1.1, range: 'melee' }], form: 'drinks the aura of anything it touches', nouns: ['Leech', 'Siphon', 'Hunger', 'Tithe', 'Communion'] },
    { kind: 'contract', label: 'Contract', effects: [{ k: 'contract', p: 1.6 }], form: 'binds its target to a promise that kills if broken', nouns: ['Oath', 'Pact', 'Covenant', 'Promise', 'Seal'] },
  ],
  4: [
    { kind: 'puppet', label: 'Control', effects: [{ k: 'control', p: 1.5 }], form: 'plants {anchor} in its target and takes over', nouns: ['Puppeteer', 'Marionette', 'Strings', 'Conductor', 'Voice'] },
    { kind: 'remote', label: 'Remote control', effects: [{ k: 'summon', p: 1.35, dur: 4 }, { k: 'damage', p: 1.1, range: 'mid' }], form: 'gives orders to objects, which obey', nouns: ['Orchestra', 'Swarm', 'Legion', 'Clockwork', 'Drones'] },
    { kind: 'command', label: 'Command', effects: [{ k: 'debuff', p: 0.7, dur: 3, stat: 'output' }, { k: 'control', p: 0.9 }], form: 'speaks commands the body cannot refuse', nouns: ['Whistle', 'Edict', 'Order', 'Decree', 'Lullaby'] },
  ],
  5: [
    { kind: 'blast', label: 'Blast', effects: [{ k: 'damage', p: 1.65, range: 'mid' }], form: 'fires aura that keeps its force at any distance', nouns: ['Comet', 'Cannon', 'Flare', 'Volley', 'Lance', 'Arrow'] },
    { kind: 'barrage', label: 'Barrage', effects: [{ k: 'damage', p: 1.5, range: 'area' }], form: 'releases aura in a storm of shots', nouns: ['Tempest', 'Hail', 'Gatling', 'Downpour', 'Fireworks'] },
    { kind: 'detached', label: 'Detached aura', effects: [{ k: 'summon', p: 1.4, dur: 4 }], form: 'sends aura off in shapes that hunt on their own', nouns: ['Swallows', 'Wisps', 'Hounds', 'Fireflies', 'Shadows'] },
    { kind: 'portal', label: 'Teleport', effects: [{ k: 'teleport', p: 1.6 }, { k: 'stealth', p: 1.3 }], form: 'opens doors between places it has marked', nouns: ['Door', 'Passage', 'Gate', 'Corridor', 'Hatch'] },
    { kind: 'mend', label: 'Healing', effects: [{ k: 'heal', p: 1.4 }], form: 'sends aura into another body to mend it', nouns: ['Balm', 'Suture', 'Mercy', 'Remedy', 'Lullaby'] },
  ],
}

const ADJ = ['Silent', 'Hollow', 'Crimson', 'Patient', 'Borrowed', 'Iron', 'Thousand', 'Midnight', 'Honest', 'Starving', 'Paper', 'Glass', 'Last', 'Sleeping', 'Golden', 'Crooked',
  'Quiet', 'Burning', 'Second', 'Blind', 'Hungry', 'Faithful', 'Drowned', 'Lucky', 'Rusted', 'Seventh', 'Bitter', 'Gentle', 'Velvet', 'Lovely', 'Deep', 'Magical', 'Crazy', 'Indoor',
  'Black', 'White', 'Little', 'Grand', 'Phantom', 'Merry', 'Lonely', 'Rotten', 'Holy', 'Royal', 'Wild', 'Twin', 'Final', 'Painted', 'Hidden', 'Feral']
const ELEMENT = ['lightning', 'ice', 'fire', 'poison', 'acid', 'smoke', 'glass', 'sand']
const MATERIAL = ['rubber', 'gum', 'wire', 'tar', 'honey', 'silk']
const OBJECTS = ['a chain', 'a cage', 'a net', 'a ribbon of iron', 'a lock']
const WEAPONS = ['a lance', 'a sword', 'a scythe', 'a hammer', 'a crossbow']
const BEASTS = ['a hound of aura', 'a lantern-eyed bird', 'a clockwork bear', 'a serpent of light', 'a pale doll']
const TOOLS = ['a compass', 'a lens', 'a ledger', 'a pocket watch', 'a bell']
const ANCHORS = ['a needle', 'a pin', 'an antenna', 'a seed', 'a coin']

export interface GenOpts {
  /** Force an archetype kind if the person's history calls for one (a doctor heals). */
  kind?: string
  /** A grudge to build a vow around (Kurapika). */
  grudge?: { org?: number; person?: number; label: string }
  name?: string
}

/**
 * Invent a Hatsu for someone, from their type, their temperament and what
 * has happened to them. Most people build in their own category. A few build
 * outside it, usually because they want something their type is bad at; the
 * sheet says so, because it costs them.
 */
export function generateHatsu(w: World, r: Rng, p: Person, o: GenOpts = {}): Hatsu {
  const f = p.facets
  let cat: NenType = p.nen.type
  let poor = false
  if (cat !== 3 && r.chance(0.18)) {
    const nb = ((cat + (r.chance(0.5) ? 1 : 5)) % 6) as NenType
    if (nb !== 3) cat = nb
  }
  if (cat !== 3 && p.mind.int < 40 && r.chance(0.25)) {
    cat = ((p.nen.type + 3) % 6) as NenType
    if (cat === 3) cat = 2
    poor = true
  }
  let pool = ARCH[cat]
  if (o.kind) {
    for (let c = 0; c < 6; c++) {
      const hit = ARCH[c as NenType].find((a) => a.kind === o.kind)
      if (hit && (c === p.nen.type || eff(p, c as NenType) >= 0.6)) { cat = c as NenType; pool = [hit]; break }
    }
  } else {
    // Temperament picks among the category's options.
    pool = pool.slice().sort((a, b) => archScore(b, f) - archScore(a, f) + (r.next() - 0.5) * 1.2)
    pool = [pool[0]]
  }
  const arch = pool[0]
  const cats: [NenType, number][] = [[cat, 1]]
  if (r.chance(0.5)) {
    const c2 = ((cat + (r.chance(0.5) ? 1 : 5)) % 6) as NenType
    if (c2 !== 3 || p.nen.type === 3) { cats[0][1] = 0.7; cats.push([c2, 0.3]) }
  }
  const conds = chooseConds(r, p, arch, o)
  const name = o.name || hatsuName(r, arch)
  const form = arch.form
    .replace('{element}', r.pick(ELEMENT)).replace('{material}', r.pick(MATERIAL)).replace('{object}', r.pick(OBJECTS))
    .replace('{weapon}', r.pick(WEAPONS)).replace('{beast}', r.pick(BEASTS)).replace('{tool}', r.pick(TOOLS)).replace('{anchor}', r.pick(ANCHORS))
  const effects = arch.effects.map((e) => ({ ...e }))
  const h: Hatsu = {
    id: `${p.id}:${name}`,
    name,
    by: p.id,
    cats,
    kind: arch.kind,
    effects,
    conds,
    stars: Math.min(12, conds.reduce((s, c) => s + c.stars, 0)),
    base: Math.round((0.85 + r.next() * 0.3 + (p.mind.int - 50) / 400 + (poor ? -0.1 : 0)) * 100) / 100,
    desc: `It ${form}.` + (poor ? ` It is not ${NEN_TYPES[p.nen.type]} work, and it costs ${p.short} more than it should.` : ''),
    t: w.t,
    uses: 0,
  }
  return h
}

function archScore(a: Archetype, f: Person['facets']): number {
  switch (a.kind) {
    case 'strike': case 'berserk': case 'blast': case 'barrage': return f.aggression / 40 + f.impulsivity / 80
    case 'guard': case 'room': return (100 - f.aggression) / 50 + f.discipline / 80
    case 'regen': case 'mend': return f.empathy / 40
    case 'element': case 'blade': case 'weapon': return f.aggression / 60 + f.discipline / 80
    case 'elastic': case 'disguise': return f.whimsy / 40 + (100 - f.honesty) / 80
    case 'chain': case 'contract': case 'curse': return f.vengefulness / 40 + f.discipline / 80
    case 'beast': case 'detached': case 'remote': return f.sociability / 60 + f.curiosity / 80
    case 'tool': case 'foresight': return f.curiosity / 40 + f.discipline / 100
    case 'puppet': case 'command': return (100 - f.empathy) / 50 + f.pride / 80
    case 'steal': case 'drain': return f.greed / 40 + (100 - f.empathy) / 80
    case 'portal': return f.composure / 50 + f.curiosity / 80
    default: return 1
  }
}

const COND_POOL: { k: HatsuCondKind; stars: number; text: string; not?: string[] }[] = [
  { k: 'named', stars: 1, text: 'The technique must be named aloud.' },
  { k: 'charge', stars: 1, text: 'It takes a moment to gather, in plain sight.' },
  { k: 'close_range', stars: 1, text: 'It only works within arm\'s reach.', not: ['blast', 'barrage', 'detached', 'portal', 'element'] },
  { k: 'daylight', stars: 1, text: 'It only works in daylight.' },
  { k: 'item', stars: 1, text: 'It needs an object the user always carries.' },
  { k: 'time_limit', stars: 1, text: 'It only lasts a few minutes a day.' },
  { k: 'stillness', stars: 2, text: 'It needs ten seconds of total stillness first.' },
  { k: 'touch_first', stars: 2, text: 'The target must have been touched first.' },
  { k: 'explain', stars: 2, text: 'The target must hear the rules explained.' },
  { k: 'self_harm', stars: 2, text: 'Every use injures the user.' },
  { k: 'cooldown', stars: 2, text: 'It cannot be used again for a day.' },
  { k: 'after_hit', stars: 3, text: 'It only unlocks after the user is hurt.', not: ['foresight', 'detached', 'beast', 'remote'] },
  { k: 'once_per_target', stars: 3, text: 'It cannot be used twice on the same person.' },
  { k: 'zetsu_after', stars: 3, text: 'Afterwards the user is left in Zetsu for an hour.' },
  { k: 'life_cost', stars: 4, text: 'Each use costs the user a year of life.' },
  { k: 'aura_all', stars: 4, text: 'It uses every scrap of aura the user has left.' },
  { k: 'death_penalty', stars: 5, text: 'If the user ever loses a fight in which it was used, the user dies.' },
]

function chooseConds(r: Rng, p: Person, arch: Archetype, o: GenOpts): HatsuCond[] {
  const f = p.facets
  const conds: HatsuCond[] = []
  // A grudge becomes the ability's whole reason to exist.
  if (o.grudge) {
    conds.push({ k: 'target_only', stars: 4, text: `It may only be used against ${o.grudge.label}.`, org: o.grudge.org, people: o.grudge.person != null ? [o.grudge.person] : undefined })
    if (f.vengefulness > 80 && f.bravery > 60 && r.chance(0.6)) conds.push({ k: 'death_penalty', stars: 5, text: `If the user uses it on anyone else, the user dies.` })
  }
  // Ambitious and disciplined people bind themselves harder.
  let n = 1 + (f.ambition > 65 ? 1 : 0) + (f.discipline > 70 ? 1 : 0) - (f.impulsivity > 75 ? 1 : 0)
  if (o.grudge) n -= 1
  const heavyOk = f.ambition > 55 || f.vengefulness > 70 || f.bravery > 75
  let tries = 0
  while (conds.length < Math.max(1, n) && tries++ < 25) {
    const c = r.pick(COND_POOL)
    if (c.not && c.not.includes(arch.kind)) continue
    if (c.stars >= 4 && !heavyOk) continue
    if (conds.some((x) => x.k === c.k)) continue
    conds.push({ k: c.k, stars: c.stars, text: c.text })
  }
  return conds
}

function hatsuName(r: Rng, a: Archetype): string {
  const noun = r.pick(a.nouns)
  const x = r.next()
  if (x < 0.55) return `${r.pick(ADJ)} ${noun}`
  if (x < 0.75) return `${noun} of the ${r.pick(ADJ)} ${r.pick(['Hour', 'Saint', 'Tide', 'Moon', 'King', 'Widow', 'Garden', 'Sea'])}`
  if (x < 0.9) return `${r.pick(['Doctor', 'Madame', 'Mister', 'Saint', 'Captain', 'Little', 'Lady', 'Old'])} ${noun}`
  return `${noun} ${r.pick(['Waltz', 'Requiem', 'Parade', 'Fugue', 'Serenade', 'Carnival', 'Express', 'Lottery'])}`
}

/** A sentence for the sheet: what categories it draws on, as a share. */
export function catLine(h: Hatsu): string {
  return h.cats.map(([c, wgt]) => `${Math.round(wgt * 100)}% ${NEN_CATS[c]}`).join(' + ')
}

export const EFFECT_LABEL: Record<EffectKind, string> = {
  damage: 'Attack', bind: 'Restraint', control: 'Control', debuff: 'Weakening', buff: 'Strengthening', transform: 'Transformation', heal: 'Healing',
  shield: 'Defence', summon: 'Nen beast', stealth: 'Concealment', teleport: 'Teleport', reveal: 'Insight', steal: 'Theft', seal: 'Sealing',
  contract: 'Contract', drain: 'Drain', speed: 'Speed', sense: 'Foresight', curse: 'Curse', debt: 'Debt', absorb: 'Absorption',
  utility: 'Utility', clone: 'Copies', explode: 'Bomb', poison: 'Poison',
}
