/**
 * Things that make a place deadly to stand in, and the disasters that cause
 * them.
 *
 * A hazard sits on a place with a severity from 0 to 1. Every day it hurts
 * the people there (aura protects against some kinds and not others), kills
 * part of the unnamed population, burns through wealth, and fades. Some
 * spread to the next town; some travel with the people who carry them.
 */
import type { CondKind } from '../sim/types'

export type HazardKind =
  | 'fire' | 'flood' | 'rubble' | 'storm' | 'cold' | 'drought' | 'ash'
  | 'plague' | 'poison' | 'radiation' | 'miasma' | 'ants' | 'rose' | 'frenzy' | 'gas' | 'blight' | 'beast' | 'vanishing'

export interface HazardDef {
  name: string
  /** One-word label for the map. */
  label: string
  /** Hit points lost per day at full severity, as a fraction of maximum. */
  hp: number
  /** A condition it can leave on someone, and the daily chance at full severity. */
  cond?: CondKind
  condP?: number
  condChance?: number
  condDays?: number
  /** How much of the harm a Nen user's aura keeps off. Fire and falling
   *  stone, a lot; disease and radiation, almost none. */
  nenResist: number
  /** Share of the population lost per day at full severity. */
  pop: number
  /** Wealth lost per day at full severity. */
  wealth: number
  /** Severity lost per day. */
  decay: number
  /** Chance per day, at full severity, to reach the nearest other place. */
  spread?: number
  /** Carried by travellers who have its condition. */
  contagious?: boolean
  /** Who can do something about it, by role. */
  helpers: string[]
  /** What a helper does there. */
  help: string
  /** For "X dies in the ___". */
  death: string
  color: string
}

export const HAZARDS: Record<HazardKind, HazardDef> = {
  fire: { name: 'fire', label: 'Fire', hp: 0.07, cond: 'burned', condP: 1, condChance: 0.25, condDays: 25, nenResist: 0.65, pop: 0.006, wealth: 0.012, decay: 0.09, spread: 0.06, helpers: ['soldier', 'officer', 'doctor', 'beast'], help: 'fighting the fire and pulling people out', death: 'the fire', color: '#f97316' },
  flood: { name: 'flooding', label: 'Flood', hp: 0.03, nenResist: 0.5, pop: 0.003, wealth: 0.01, decay: 0.05, helpers: ['soldier', 'officer', 'sea', 'doctor'], help: 'getting people off the rooftops', death: 'the floodwater', color: '#3b82f6' },
  rubble: { name: 'collapsed buildings', label: 'Rubble', hp: 0.02, cond: 'disease', condP: 0.6, condChance: 0.05, condDays: 30, nenResist: 0.6, pop: 0.002, wealth: 0.006, decay: 0.04, helpers: ['soldier', 'officer', 'doctor', 'ruins', 'master'], help: 'digging survivors out of the rubble', death: 'the ruins of the city', color: '#a8a29e' },
  storm: { name: 'the storm', label: 'Storm', hp: 0.025, nenResist: 0.6, pop: 0.002, wealth: 0.008, decay: 0.25, helpers: ['sea', 'soldier'], help: 'bringing boats in through the storm', death: 'the storm', color: '#64748b' },
  cold: { name: 'killing cold', label: 'Cold', hp: 0.025, cond: 'frostbite', condP: 1, condChance: 0.12, condDays: 20, nenResist: 0.55, pop: 0.0015, wealth: 0.003, decay: 0.04, helpers: ['soldier', 'doctor'], help: 'bringing fuel and blankets to the cut-off', death: 'the cold', color: '#93c5fd' },
  drought: { name: 'drought and hunger', label: 'Famine', hp: 0.008, nenResist: 0.2, pop: 0.0015, wealth: 0.004, decay: 0.006, helpers: ['merchant', 'politician', 'doctor'], help: 'bringing in grain', death: 'hunger', color: '#ca8a04' },
  ash: { name: 'falling ash', label: 'Ash', hp: 0.035, cond: 'poison', condP: 0.6, condChance: 0.12, condDays: 10, nenResist: 0.45, pop: 0.003, wealth: 0.01, decay: 0.05, spread: 0.08, helpers: ['soldier', 'doctor'], help: 'evacuating the towns under the ash', death: 'the ash cloud', color: '#57534e' },
  plague: { name: 'plague', label: 'Plague', hp: 0.0, cond: 'disease', condP: 1.2, condChance: 0.08, condDays: 40, nenResist: 0.15, pop: 0.0025, wealth: 0.004, decay: 0.012, contagious: true, helpers: ['doctor', 'virus'], help: 'treating the sick and hunting the source', death: 'the plague', color: '#84cc16' },
  poison: { name: 'poisoned air and water', label: 'Poison', hp: 0.02, cond: 'poison', condP: 1, condChance: 0.2, condDays: 12, nenResist: 0.3, pop: 0.003, wealth: 0.006, decay: 0.03, helpers: ['doctor', 'virus'], help: 'treating the poisoned and cleaning the wells', death: 'the poison', color: '#a3e635' },
  radiation: { name: 'radiation', label: 'Fallout', hp: 0.008, cond: 'radiation', condP: 1, condChance: 0.15, condDays: 400, nenResist: 0.1, pop: 0.002, wealth: 0.004, decay: 0.0015, helpers: ['virus', 'doctor'], help: 'measuring the fallout and moving people out', death: 'radiation sickness', color: '#facc15' },
  miasma: { name: 'a lingering Nen curse', label: 'Miasma', hp: 0.02, cond: 'curse', condP: 0.85, condChance: 0.06, condDays: 60, nenResist: 0.5, pop: 0.001, wealth: 0.002, decay: 0.004, helpers: ['master', 'exorcist'], help: 'trying to exorcise the curse', death: 'the curse in the place', color: '#8b5cf6' },
  ants: { name: 'Chimera Ants', label: 'Ants', hp: 0.0, nenResist: 0, pop: 0.004, wealth: 0.004, decay: 0.05, helpers: ['beast', 'blacklist'], help: 'fighting the ants', death: 'the ants', color: '#b91c1c' },
  rose: { name: "the Rose's fallout", label: 'Rose', hp: 0.02, cond: 'contaminated', condP: 2, condChance: 0.2, condDays: 300, nenResist: 0.05, pop: 0.004, wealth: 0.01, decay: 0.0004, spread: 0.01, helpers: ['virus', 'doctor'], help: 'getting survivors out of the fallout', death: "the Rose's poison", color: '#e11d48' },
  frenzy: { name: 'a killing madness', label: 'Frenzy', hp: 0.0, nenResist: 0.4, pop: 0.003, wealth: 0.003, decay: 0.02, helpers: ['crime', 'blacklist', 'soldier'], help: 'stopping the killing', death: 'the madness', color: '#dc2626' },
  gas: { name: 'a living gas', label: 'Gas', hp: 0.03, nenResist: 0.25, pop: 0.003, wealth: 0.002, decay: 0.01, spread: 0.02, helpers: ['virus', 'master'], help: 'keeping people away from the gas', death: 'the gas', color: '#c084fc' },
  beast: { name: 'a thing from beyond the lake', label: 'Beast', hp: 0.0, nenResist: 0, pop: 0.003, wealth: 0.004, decay: 0.002, helpers: ['beast', 'blacklist'], help: 'hunting the thing', death: 'the thing from beyond the lake', color: '#7f1d1d' },
  vanishing: { name: 'people vanishing', label: 'Missing', hp: 0.0, nenResist: 0, pop: 0.001, wealth: 0.001, decay: 0.004, helpers: ['crime', 'beast', 'blacklist'], help: 'searching for the missing', death: 'whatever takes them', color: '#334155' },
  blight: { name: 'a blight on everything that grows', label: 'Blight', hp: 0.004, nenResist: 0.2, pop: 0.001, wealth: 0.006, decay: 0.004, spread: 0.03, helpers: ['beast', 'scholar'], help: 'burning the blighted fields', death: 'the blight', color: '#65a30d' },
}

/* ================= Natural disasters ================= */

export type DisasterKind = 'earthquake' | 'tsunami' | 'eruption' | 'wildfire' | 'flood' | 'typhoon' | 'blizzard' | 'drought' | 'epidemic' | 'firestorm'

export interface DisasterDef {
  name: string
  /** Relative chance per year. */
  rate: number
  /** Weight for a given place: its kind, features, coast, latitude, mountains. */
  where: (pl: { kind: string; features: string[]; port: boolean; y: number; mountain: number; pop: number }) => number
  /** Instant harm: share of the population, chance a named person is hurt
   *  and how badly, at full severity. */
  instant: { pop: number; hurt: number; wound: number; wealth: number }
  /** What it leaves behind. */
  leaves: [HazardKind, number][]
  /** Headline: {L} is the place. */
  text: string[]
}

export const DISASTERS: Record<DisasterKind, DisasterDef> = {
  earthquake: {
    name: 'earthquake', rate: 1.1,
    where: (p) => (p.kind === 'city' || p.kind === 'town' ? 1 : 0.4) * (1 + p.mountain * 2),
    instant: { pop: 0.02, hurt: 0.35, wound: 0.35, wealth: 0.12 }, leaves: [['rubble', 0.8], ['fire', 0.35]],
    text: ['The ground under {L} heaves for forty seconds. When it stops, whole streets are gone.', 'An earthquake tears through {L} in the middle of the night.'],
  },
  tsunami: {
    name: 'tsunami', rate: 0.35,
    where: (p) => (p.port || p.features.includes('coast') || p.features.includes('harbor') ? 1.2 : 0) + (p.kind === 'island' ? 1 : 0),
    instant: { pop: 0.035, hurt: 0.4, wound: 0.4, wealth: 0.18 }, leaves: [['flood', 0.9], ['plague', 0.2]],
    text: ['The sea pulls back from {L}, and then it comes in as a wall.', 'A tsunami hits {L} with almost no warning.'],
  },
  eruption: {
    name: 'volcanic eruption', rate: 0.25,
    where: (p) => p.mountain * 3,
    instant: { pop: 0.015, hurt: 0.3, wound: 0.4, wealth: 0.1 }, leaves: [['ash', 0.9], ['fire', 0.4]],
    text: ['The mountain above {L} opens. Ash turns noon into night.', 'A volcano wakes near {L}.'],
  },
  wildfire: {
    name: 'wildfire', rate: 0.9,
    where: (p) => (p.kind === 'wild' || p.kind === 'village' ? 1.2 : 0.15) * (p.features.includes('desert') ? 0.3 : 1) * (p.features.includes('jungle') ? 0.6 : 1),
    instant: { pop: 0.004, hurt: 0.15, wound: 0.25, wealth: 0.04 }, leaves: [['fire', 0.85]],
    text: ['A wildfire comes over the hills toward {L}.', 'The country around {L} is burning.'],
  },
  firestorm: {
    name: 'great fire', rate: 0.3,
    where: (p) => (p.kind === 'city' ? 1 : 0) * (p.features.includes('slums') || p.features.includes('market') ? 1.4 : 1),
    instant: { pop: 0.008, hurt: 0.2, wound: 0.3, wealth: 0.1 }, leaves: [['fire', 1]],
    text: ['A fire starts in a warehouse in {L} and by dawn half a district is ash.', 'Fire sweeps through the old quarter of {L}.'],
  },
  flood: {
    name: 'flood', rate: 0.8,
    where: (p) => (p.kind === 'city' || p.kind === 'town' || p.kind === 'village' ? 1 : 0.3) * (p.features.includes('desert') ? 0.1 : 1) * (p.port ? 1.3 : 1),
    instant: { pop: 0.01, hurt: 0.2, wound: 0.25, wealth: 0.07 }, leaves: [['flood', 0.85], ['plague', 0.25]],
    text: ['After nine days of rain, the river walks into {L}.', 'Floods cut {L} off from the rest of the world.'],
  },
  typhoon: {
    name: 'typhoon', rate: 0.7,
    where: (p) => (p.port || p.kind === 'island' || p.features.includes('coast') || p.features.includes('sea') ? 1.4 : 0.1),
    instant: { pop: 0.006, hurt: 0.2, wound: 0.25, wealth: 0.06 }, leaves: [['storm', 1], ['flood', 0.5]],
    text: ['The worst storm in a generation hits {L}.', 'A typhoon makes landfall at {L}.'],
  },
  blizzard: {
    name: 'blizzard', rate: 0.5,
    where: (p) => (p.y < 16 ? 1.6 : p.y < 26 ? 0.4 : 0) + p.mountain * 0.5,
    instant: { pop: 0.003, hurt: 0.1, wound: 0.15, wealth: 0.03 }, leaves: [['cold', 1]],
    text: ['Snow buries {L} to the second storey, and keeps falling.', 'A killing cold settles on {L}.'],
  },
  drought: {
    name: 'drought', rate: 0.4,
    where: (p) => (p.kind === 'village' || p.kind === 'wild' || p.kind === 'town' ? 1 : 0.5) * (p.features.includes('desert') ? 2 : 1) * (p.y > 45 ? 1.4 : 0.8),
    instant: { pop: 0, hurt: 0, wound: 0, wealth: 0.03 }, leaves: [['drought', 0.9]],
    text: ['No rain has fallen on {L} for a year. The wells are dry and the fields are dust.', 'The harvest fails around {L}. Then it fails again.'],
  },
  epidemic: {
    name: 'epidemic', rate: 0.55,
    where: (p) => (p.kind === 'city' ? 1.5 : 0.4) * (p.features.includes('slums') ? 2 : 1) * Math.min(2, 0.5 + p.pop / 2000),
    instant: { pop: 0.002, hurt: 0, wound: 0, wealth: 0.02 }, leaves: [['plague', 0.9]],
    text: ['A fever with no name moves through {L}. The hospitals fill in a week.', 'Doctors in {L} report a new disease, and then stop reporting because there are too few of them.'],
  },
}
