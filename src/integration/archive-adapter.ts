/**
 * Bringing a member's work from the Nen Archive into the world.
 *
 * The site's own types are mirrored here structurally (only the fields the
 * game reads), so this file has no dependency on the site's code and the
 * site can call it with its real objects:
 *
 *   OriginalCharacter  (lib/features/originals/types.ts)  -> CharacterSpec
 *   AbilityDocument    (lib/nen-abilities/ability.ts)       -> HatsuSpec
 *
 * The character starts the way a Phase 4 run does: young, unknown, Nen
 * locked. Their Ledger ability waits as a destined Hatsu, and arrives when
 * they have earned it.
 */
import type { CharacterSpec } from '../sim/player/create'
import type { EffectKind, HatsuCondKind, HatsuSpec } from '../sim/types'
import type { NenType } from '../sim/constants'

/** The Archive's clockwise order, which is also the game's. */
export const ARCHIVE_TYPES = ['Enhancer', 'Transmuter', 'Conjurer', 'Specialist', 'Manipulator', 'Emitter'] as const
export type ArchiveNenType = (typeof ARCHIVE_TYPES)[number]

export interface ArchiveOC {
  name: string
  gender: 'male' | 'female' | 'other' | 'unspecified'
  age: number | null
  occupation: string | null
  affiliationPresets?: string[]
  personality?: string
  backstory?: string
  realized: { nenType: ArchiveNenType | null; hunterLicense?: boolean; abilityRefs?: { abilityId: string }[] } | null
}

export interface ArchiveAbility {
  title: string
  mainDescription: string
  allocations: { type: ArchiveNenType; role: 'main' | 'secondary'; points: number }[]
  vows: { activationDifficulty: number; physicalMentalCost: number; targetingSpecificity: number; consequencePenalty: number; frequencyCooldown: number }
  vowText?: Partial<Record<keyof ArchiveAbility['vows'], string>>
  grade: 'S' | 'A' | 'B' | 'C'
}

const typeIdx = (t: ArchiveNenType | null | undefined): NenType | -1 => (t ? (ARCHIVE_TYPES.indexOf(t) as NenType) : -1)

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** Words in a personality write-up, and which way they push. */
const TRAITS: [RegExp, Partial<Record<string, number>>][] = [
  [/\b(brave|fearless|bold|reckless|daring)\b/i, { bravery: 25, impulsivity: 10 }],
  [/\b(kind|gentle|caring|compassionate|warm|empath)/i, { empathy: 25, cruelty: -15 }],
  [/\b(cruel|sadis|ruthless|cold|merciless)/i, { cruelty: 25, empathy: -20 }],
  [/\b(curious|inquisitive|explor|wander)/i, { curiosity: 25 }],
  [/\b(loyal|devoted|faithful)\b/i, { loyalty: 25 }],
  [/\b(proud|arrogant|vain|haughty)/i, { pride: 25 }],
  [/\b(greedy|money|rich|wealth)/i, { greed: 20 }],
  [/\b(shy|quiet|reserved|introvert|lonely)/i, { sociability: -20 }],
  [/\b(cheerful|outgoing|friendly|social|talkative)/i, { sociability: 20 }],
  [/\b(calm|composed|stoic|patient)/i, { composure: 20, impulsivity: -10 }],
  [/\b(hot-?headed|impulsive|rash|angry|short temper)/i, { impulsivity: 20, composure: -15, aggression: 10 }],
  [/\b(ambitious|driven|determined)/i, { ambition: 25, discipline: 10 }],
  [/\b(liar|deceptive|manipulat|cunning|sly)/i, { honesty: -25 }],
  [/\b(honest|truthful|sincere)/i, { honesty: 20 }],
  [/\b(disciplined|methodical|serious|strict)/i, { discipline: 20 }],
  [/\b(playful|whimsical|eccentric|strange|odd)/i, { whimsy: 25 }],
  [/\b(vengeful|revenge|grudge)/i, { vengefulness: 25 }],
  [/\b(romantic|in love|lover)/i, { romantic: 20 }],
]

function facetsFromText(text: string): CharacterSpec['facets'] {
  const out: Record<string, number> = {}
  for (const [re, push] of TRAITS) if (re.test(text)) for (const k in push) out[k] = Math.max(-40, Math.min(40, (out[k] || 0) + push[k]!))
  return out
}

function roleFromOccupation(o: string | null): CharacterSpec['role'] {
  const s = (o || '').toLowerCase()
  if (/doctor|medic|nurse|healer/.test(s)) return 'doctor'
  if (/thief|bandit|smuggl|pickpocket/.test(s)) return 'thief'
  if (/merc|soldier|bodyguard|guard/.test(s)) return 'mercenary'
  if (/student|school|apprentice/.test(s)) return 'student'
  if (/scholar|research|archaeolog|historian|librar/.test(s)) return 'scholar'
  if (/merchant|trader|shop|business/.test(s)) return 'merchant'
  if (/fight|martial|boxer|arena|warrior/.test(s)) return 'fighter'
  return 'drifter'
}

/** Where an affiliation puts someone at the start. */
const HOME_BY_AFFILIATION: Record<string, string> = {
  'hunter-association': 'swardani', zodiacs: 'swardani', 'phantom-troupe': 'meteor', 'mafia-community': 'yorknew', 'ten-dons': 'yorknew',
  'heavens-arena': 'arena', 'kakin-royal-guard': 'kakin', 'kakin-royal-family': 'kakin', 'kakin-empire': 'kakin', 'zoldyck-family': 'kukuroo',
  'nostrade-family': 'yorknew', 'meteor-city': 'meteor', 'yorknew-city': 'yorknew', 'zaban-city': 'zaban', 'dolle-harbor': 'dolle',
  'swardani-city': 'swardani', 'whale-island': 'whale', 'east-gorteau': 'peijin', 'republic-of-padokea': 'kukuroo', 'republic-of-rokario': 'rokario',
}

export function fromOriginal(oc: ArchiveOC, placeIdByKey: (key: string) => number, ability?: ArchiveAbility): CharacterSpec {
  const text = `${oc.personality || ''} ${oc.backstory || ''}`
  const homeKey = (oc.affiliationPresets || []).map((a) => HOME_BY_AFFILIATION[a]).find(Boolean) || 'dolle'
  // The world's people are recorded as male or female; anyone else is placed
  // by a stable hash of their name, and the chronicle refers to people by name.
  const sex: 'm' | 'f' = oc.gender === 'male' ? 'm' : oc.gender === 'female' ? 'f' : hash(oc.name) % 2 ? 'f' : 'm'
  const dreams: CharacterSpec['dreams'] = []
  if (/\bhunter\b/i.test(text) || oc.realized?.hunterLicense) dreams.push({ k: 'hunter' })
  if (/revenge|avenge|vengeance/i.test(text)) dreams.push({ k: 'strongest' })
  if (/dark continent|beyond the lake|explor/i.test(text)) dreams.push({ k: 'explore' })
  if (/\b(heal|doctor|cure)/i.test(text)) dreams.push({ k: 'doctor' })
  if (/\bmoney|rich|treasure/i.test(text)) dreams.push({ k: 'wealth' })
  if (!dreams.length) dreams.push({ k: 'hunter' })
  return {
    name: oc.name.slice(0, 40),
    sex,
    age: Math.max(12, Math.min(45, oc.age ?? 16)),
    type: typeIdx(oc.realized?.nenType),
    home: placeIdByKey(homeKey),
    role: roleFromOccupation(oc.occupation),
    facets: facetsFromText(text),
    dreams: dreams.slice(0, 3),
    talent: 'gifted',
    bio: (oc.backstory || oc.personality || '').slice(0, 500) || undefined,
    hatsu: ability ? fromAbility(ability) : undefined,
  }
}

/** What an ability does, read from how its author described it. */
const EFFECT_WORDS: [RegExp, EffectKind, NonNullable<HatsuSpec['effects'][number]['range']>][] = [
  [/\b(chain|bind|restrain|trap|cage|tie|sticky|web)/i, 'bind', 'mid'],
  [/\b(control|puppet|manipulat|possess|command)/i, 'control', 'touch'],
  [/\b(heal|mend|restore|regenerat)/i, 'heal', 'self'],
  [/\b(clone|copy|double|decoy)/i, 'clone', 'self'],
  [/\b(teleport|warp|portal|swap places)/i, 'teleport', 'self'],
  [/\b(poison|venom|toxin)/i, 'poison', 'melee'],
  [/\b(explo|bomb|detonat)/i, 'explode', 'touch'],
  [/\b(shield|barrier|armou?r|wall)/i, 'shield', 'self'],
  [/\b(summon|beast|creature|familiar|spirit)/i, 'summon', 'mid'],
  [/\b(invisib|stealth|hide|conceal)/i, 'stealth', 'self'],
  [/\b(see|sense|detect|foresee|predict|read)/i, 'sense', 'self'],
  [/\b(seal|nullif|cancel|disable)/i, 'seal', 'touch'],
  [/\b(steal|take|absorb|drain)/i, 'drain', 'touch'],
  [/\b(curse|hex|weaken|slow)/i, 'debuff', 'mid'],
  [/\b(speed|fast|lightning|accelerat)/i, 'speed', 'self'],
  [/\b(strength|power up|enhance|boost)/i, 'buff', 'self'],
  [/\b(beam|blast|shot|projectile|bullet|ray|fire)/i, 'damage', 'far'],
]
const DEFAULT_EFFECT: Record<number, [EffectKind, NonNullable<HatsuSpec['effects'][number]['range']>]> = { 0: ['damage', 'melee'], 1: ['damage', 'mid'], 2: ['summon', 'mid'], 3: ['sense', 'self'], 4: ['control', 'touch'], 5: ['damage', 'far'] }

export function fromAbility(a: ArchiveAbility): HatsuSpec {
  const total = a.allocations.reduce((s, x) => s + Math.max(0, x.points), 0) || 1
  const cats = a.allocations.filter((x) => x.points > 0).sort((x, y) => (x.role === 'main' ? -1 : 1) - (y.role === 'main' ? -1 : 1) || y.points - x.points).slice(0, 3)
    .map((x) => [typeIdx(x.type) as NenType, x.points / total] as [NenType, number])
  const main = cats[0]?.[0] ?? 0
  const effects: HatsuSpec['effects'] = []
  for (const [re, k, range] of EFFECT_WORDS) if (re.test(`${a.title} ${a.mainDescription}`) && !effects.some((e) => e.k === k)) effects.push({ k, p: 1.3, range, dur: ['bind', 'buff', 'speed', 'sense', 'summon', 'shield'].includes(k) ? 3 : undefined })
  if (!effects.length) { const [k, range] = DEFAULT_EFFECT[main]; effects.push({ k, p: 1.4, range }) }
  // An ability that does many things does each less well.
  const share = effects.length > 1 ? 1 / Math.sqrt(effects.length) : 1
  for (const e of effects) e.p = Math.round(Math.max(0.6, e.p * share * (a.grade === 'S' ? 1.4 : a.grade === 'A' ? 1.2 : a.grade === 'B' ? 1 : 0.85)) * 100) / 100
  // Each vow category the author committed to becomes a condition, as hard as they made it.
  const v = a.vows, t = a.vowText || {}
  const conds: HatsuSpec['conds'] = []
  const add = (k: HatsuCondKind, stars: number, fallback: string, key: keyof ArchiveAbility['vows']) => { if (stars > 0) conds.push({ k, stars: Math.min(5, stars), text: (t[key] || fallback).slice(0, 140) }) }
  add(v.activationDifficulty >= 3 ? 'charge' : 'named', v.activationDifficulty, 'It is hard to set off.', 'activationDifficulty')
  add(v.physicalMentalCost >= 4 ? 'life_cost' : 'self_harm', v.physicalMentalCost, 'It costs the user dearly.', 'physicalMentalCost')
  add(v.targetingSpecificity >= 3 ? 'once_per_target' : 'touch_first', v.targetingSpecificity, 'It only works on particular targets.', 'targetingSpecificity')
  add(v.consequencePenalty >= 4 ? 'death_penalty' : 'zetsu_after', v.consequencePenalty, 'Breaking its rule has a price.', 'consequencePenalty')
  add('cooldown', v.frequencyCooldown, 'It cannot be used often.', 'frequencyCooldown')
  return {
    name: a.title.replace(/[{}<>]/g, '').slice(0, 40),
    kind: 'archive',
    desc: a.mainDescription.slice(0, 300),
    cats: cats.length ? cats : [[0, 1]],
    effects: effects.slice(0, 3),
    conds,
    base: a.grade === 'S' ? 1.25 : a.grade === 'A' ? 1.12 : a.grade === 'B' ? 1 : 0.9,
    at: 34,
  }
}
