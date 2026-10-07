/**
 * Enumerations and fixed tables shared by every system. Content (people,
 * places, factions) lives in src/data; these are the shapes that content is
 * written in.
 */

/* ---------------- Nen categories ---------------- */

/** Hex order, clockwise, as Wing draws it and as the Nen Archive quiz uses. */
export const NEN_TYPES = ['Enhancer', 'Transmuter', 'Conjurer', 'Specialist', 'Manipulator', 'Emitter'] as const
export const NEN_CATS = ['Enhancement', 'Transmutation', 'Conjuration', 'Specialization', 'Manipulation', 'Emission'] as const
export const NEN_KEYS = ['enh', 'tra', 'con', 'spe', 'man', 'emi'] as const
export type NenKey = (typeof NEN_KEYS)[number]
export type NenType = 0 | 1 | 2 | 3 | 4 | 5

/** Colours match the Nen Archive's --nen-* tokens so a type looks the same
 *  in the game as on the quiz results page. */
export const NEN_COLORS = ['#22c55e', '#8b5cf6', '#ef4444', '#3b82f6', '#808080', '#f97316']

/**
 * How much of their aura a person can put into each category.
 *
 * This is the chart from the series: 100% for your own type, 80% for each
 * neighbour, 60% two steps away, 40% for the opposite. Only Specialists can
 * use Specialization at all. A Specialist's own row follows the same hex
 * distances (80/60/40) rather than the Nen Archive quiz's flat zero, because
 * Chrollo, Neon and Kurapika all use other categories in the story.
 */
export function efficiency(type: NenType, cat: NenType): number {
  if (cat === 3 && type !== 3) return 0
  const d = Math.abs(type - cat)
  const dist = Math.min(d, 6 - d)
  return [1, 0.8, 0.6, 0.4][dist]
}

/** "Water divination" results, one per type, in hex order. */
export const WATER_DIVINATION = [
  'the water spills over the rim of the glass',
  'the taste of the water changes',
  'impurities appear in the water',
  'something else entirely happens to the water and the leaf',
  'the leaf on the water moves',
  'the colour of the water changes',
]

/* ---------------- Nen techniques ---------------- */

export const TECHS = ['ten', 'zetsu', 'ren', 'hatsu', 'gyo', 'shu', 'in', 'en', 'ken', 'ko', 'ryu'] as const
export type Tech = (typeof TECHS)[number]
export const TECH_INFO: Record<Tech, { n: string; req: number; d: string }> = {
  ten: { n: 'Ten', req: 0, d: 'Holds aura close to the body. Slows ageing and blunts other people\'s aura.' },
  zetsu: { n: 'Zetsu', req: 4, d: 'Closes the aura nodes. Hides presence, speeds recovery, leaves the body bare to Nen.' },
  ren: { n: 'Ren', req: 10, d: 'Forces out more aura than usual. Unlocks full output.' },
  hatsu: { n: 'Hatsu', req: 22, d: 'Releases aura as a personal ability. Water divination tells the type.' },
  gyo: { n: 'Gyo', req: 26, d: 'Aura gathered in one place, usually the eyes. Sees what In hides.' },
  shu: { n: 'Shu', req: 30, d: 'Aura spread into an object, which becomes part of the body.' },
  in: { n: 'In', req: 36, d: 'Hides aura from sight. Only Gyo sees it.' },
  en: { n: 'En', req: 42, d: 'Aura stretched into a sphere that feels everything inside it.' },
  ken: { n: 'Ken', req: 46, d: 'Ren held over the whole body as armour, for as long as it lasts.' },
  ko: { n: 'Ko', req: 52, d: 'All aura in one spot. Devastating if it lands, defenceless everywhere else.' },
  ryu: { n: 'Ryu', req: 60, d: 'Aura moved between attack and defence mid-fight, in real time.' },
}

/* ---------------- Personality ---------------- */

/** Facets, 0-100, 50 is ordinary. */
export const FACETS = [
  'bravery', 'aggression', 'empathy', 'honesty', 'loyalty', 'ambition', 'curiosity', 'discipline',
  'pride', 'greed', 'cruelty', 'impulsivity', 'sociability', 'trust', 'vengefulness', 'whimsy', 'composure', 'romantic',
] as const
export type Facet = (typeof FACETS)[number]
export const FACET_LABEL: Record<Facet, [string, string]> = {
  bravery: ['Fearful', 'Fearless'], aggression: ['Gentle', 'Violent'], empathy: ['Cold', 'Compassionate'],
  honesty: ['Deceitful', 'Honest'], loyalty: ['Fickle', 'Loyal'], ambition: ['Content', 'Ambitious'],
  curiosity: ['Incurious', 'Curious'], discipline: ['Unruly', 'Disciplined'], pride: ['Humble', 'Proud'],
  greed: ['Generous', 'Greedy'], cruelty: ['Kind', 'Cruel'], impulsivity: ['Deliberate', 'Impulsive'],
  sociability: ['Solitary', 'Sociable'], trust: ['Suspicious', 'Trusting'], vengefulness: ['Forgiving', 'Vengeful'],
  whimsy: ['Serious', 'Whimsical'], composure: ['Anxious', 'Composed'], romantic: ['Unromantic', 'Romantic'],
}

/** Values, -50 to 50. What a person thinks matters. */
export const VALUES = ['family', 'friendship', 'law', 'power', 'wealth', 'knowledge', 'nature', 'honour', 'peace', 'freedom', 'strength', 'tradition'] as const
export type Value = (typeof VALUES)[number]

/* ---------------- Needs ---------------- */

/** Needs fall day by day and are met by doing things. Each person weights
 *  them differently; an unmet need they care about is stress. */
export const NEEDS = [
  'rest', 'social', 'family', 'romance', 'fight', 'train', 'learn', 'wealth', 'adventure', 'purpose', 'fame', 'leisure', 'justice', 'solitude',
] as const
export type Need = (typeof NEEDS)[number]
export const NEED_LABEL: Record<Need, string> = {
  rest: 'Rest', social: 'Company', family: 'Family', romance: 'Love', fight: 'A real fight', train: 'Getting stronger',
  learn: 'Learning', wealth: 'Money', adventure: 'Adventure', purpose: 'Duty', fame: 'Recognition', leisure: 'Fun',
  justice: 'Doing right', solitude: 'Time alone',
}

/* ---------------- Skills ---------------- */

export const SKILLS = [
  'unarmed', 'blades', 'firearms', 'thrown', 'stealth', 'perception', 'tracking', 'survival', 'medicine',
  'negotiation', 'deception', 'leadership', 'strategy', 'scholarship', 'gambling', 'cooking', 'assassination', 'piloting',
] as const
export type Skill = (typeof SKILLS)[number]

/* ---------------- Body ---------------- */

export const ATTRS = ['str', 'agi', 'tou', 'endu', 'refl', 'senses'] as const
export type Attr = (typeof ATTRS)[number]
export const ATTR_LABEL: Record<Attr, string> = { str: 'Strength', agi: 'Agility', tou: 'Toughness', endu: 'Endurance', refl: 'Reflexes', senses: 'Senses' }
export const MINDS = ['int', 'will', 'focus', 'intuition', 'charisma'] as const
export type MindAttr = (typeof MINDS)[number]
export const MIND_LABEL: Record<MindAttr, string> = { int: 'Intellect', will: 'Willpower', focus: 'Focus', intuition: 'Intuition', charisma: 'Charisma' }

export const BODY_PARTS = ['head', 'eye', 'torso', 'larm', 'rarm', 'hand', 'lleg', 'rleg', 'organs'] as const
export type BodyPart = (typeof BODY_PARTS)[number]
export const PART_INFO: Record<BodyPart, { w: number; names: [string, string, string]; bleed: boolean; lose: boolean }> = {
  head: { w: 1.4, names: ['cut scalp', 'concussion', 'fractured skull'], bleed: true, lose: false },
  eye: { w: 0.35, names: ['swollen eye', 'damaged eye', 'lost eye'], bleed: false, lose: true },
  torso: { w: 3, names: ['bruised ribs', 'broken ribs', 'crushed chest'], bleed: true, lose: false },
  larm: { w: 1.8, names: ['sprained left arm', 'broken left arm', 'severed left arm'], bleed: true, lose: true },
  rarm: { w: 1.8, names: ['sprained right arm', 'broken right arm', 'severed right arm'], bleed: true, lose: true },
  hand: { w: 0.9, names: ['jammed fingers', 'broken hand', 'severed hand'], bleed: true, lose: true },
  lleg: { w: 1.5, names: ['sprained left leg', 'broken left leg', 'shattered left leg'], bleed: true, lose: true },
  rleg: { w: 1.5, names: ['sprained right leg', 'broken right leg', 'shattered right leg'], bleed: true, lose: true },
  organs: { w: 0.8, names: ['internal bruising', 'internal bleeding', 'ruptured organs'], bleed: true, lose: false },
}

/* ---------------- Relationships ---------------- */

/** Bond kinds a relationship can carry. Several can hold at once. */
export const BONDS = [
  'friend', 'bestFriend', 'lover', 'spouse', 'ex', 'rival', 'nemesis', 'mentor', 'student',
  'parent', 'child', 'sibling', 'comrade', 'master', 'servant', 'employer', 'employee', 'guardian', 'ward', 'crush',
] as const
export type Bond = (typeof BONDS)[number]
export const BOND_LABEL: Record<Bond, string> = {
  friend: 'Friend', bestFriend: 'Best friend', lover: 'Lover', spouse: 'Spouse', ex: 'Former partner', rival: 'Rival', nemesis: 'Sworn enemy',
  mentor: 'Teacher', student: 'Student', parent: 'Parent', child: 'Child', sibling: 'Sibling', comrade: 'Comrade', master: 'Master',
  servant: 'Servant', employer: 'Employer', employee: 'Employee', guardian: 'Guardian', ward: 'Ward', crush: 'Infatuation',
}
/** The reverse of each bond, so setting one side sets the other. */
export const BOND_PAIR: Record<Bond, Bond> = {
  friend: 'friend', bestFriend: 'bestFriend', lover: 'lover', spouse: 'spouse', ex: 'ex', rival: 'rival', nemesis: 'nemesis',
  mentor: 'student', student: 'mentor', parent: 'child', child: 'parent', sibling: 'sibling', comrade: 'comrade', master: 'servant',
  servant: 'master', employer: 'employee', employee: 'employer', guardian: 'ward', ward: 'guardian', crush: 'crush',
}

/* ---------------- Roles (occupations) ---------------- */

export const ROLES: Record<string, { n: string; hunter?: boolean; pay: number; tags?: string[] }> = {
  civilian: { n: 'Civilian', pay: 0.03 },
  drifter: { n: 'Drifter', pay: 0.01 },
  student: { n: 'Student', pay: 0 },
  child: { n: 'Child', pay: 0 },
  fighter: { n: 'Arena fighter', pay: 0.08 },
  master: { n: 'Nen master', pay: 0.06 },
  doctor: { n: 'Doctor', pay: 0.1 },
  merchant: { n: 'Merchant', pay: 0.12 },
  scholar: { n: 'Scholar', pay: 0.05 },
  rookie: { n: 'Rookie Hunter', hunter: true, pay: 0.05 },
  blacklist: { n: 'Blacklist Hunter', hunter: true, pay: 0.15 },
  treasure: { n: 'Treasure Hunter', hunter: true, pay: 0.12 },
  gourmet: { n: 'Gourmet Hunter', hunter: true, pay: 0.1 },
  beast: { n: 'Beast Hunter', hunter: true, pay: 0.1 },
  ruins: { n: 'Ruins Hunter', hunter: true, pay: 0.1 },
  sea: { n: 'Sea Hunter', hunter: true, pay: 0.1 },
  jackpot: { n: 'Jackpot Hunter', hunter: true, pay: 0.3 },
  virus: { n: 'Virus Hunter', hunter: true, pay: 0.15 },
  crime: { n: 'Crime Hunter', hunter: true, pay: 0.12 },
  info: { n: 'Information Hunter', hunter: true, pay: 0.15 },
  contract: { n: 'Contract Hunter', hunter: true, pay: 0.14 },
  poacher: { n: 'Poacher', pay: 0.1 },
  chairman: { n: 'Chairman', hunter: true, pay: 0.3 },
  zodiac: { n: 'Zodiac', hunter: true, pay: 0.25 },
  examiner: { n: 'Examiner', hunter: true, pay: 0.1 },
  thief: { n: 'Thief', pay: 0.15 },
  assassin: { n: 'Assassin', pay: 0.3 },
  butler: { n: 'Butler', pay: 0.06 },
  mafioso: { n: 'Mafioso', pay: 0.08 },
  don: { n: 'Mafia boss', pay: 0.6 },
  guard: { n: 'Bodyguard', pay: 0.1 },
  mercenary: { n: 'Mercenary', pay: 0.1 },
  prince: { n: 'Prince', pay: 0.5 },
  royal: { n: 'Royal', pay: 0.4 },
  ruler: { n: 'Head of state', pay: 1 },
  politician: { n: 'Politician', pay: 0.2 },
  soldier: { n: 'Soldier', pay: 0.04 },
  officer: { n: 'Officer', pay: 0.08 },
  spy: { n: 'Agent', pay: 0.1 },
  ant: { n: 'Chimera Ant', pay: 0 },
  gamer: { n: 'Greed Island player', pay: 0.02 },
  gamemaster: { n: 'Game master', pay: 0.1 },
  explorer: { n: 'Explorer', pay: 0.12 },
  criminal: { n: 'Criminal', pay: 0.06 },
  monk: { n: 'Monk', pay: 0.01 },
  ninja: { n: 'Ninja', pay: 0.08 },
  fortune: { n: 'Fortune teller', pay: 0.2 },
  gungi: { n: 'Gungi player', pay: 0.02 },
}

export const SPECIES = ['human', 'ant', 'beast'] as const
export type Species = (typeof SPECIES)[number]
