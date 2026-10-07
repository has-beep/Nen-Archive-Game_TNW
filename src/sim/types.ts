/**
 * The world's data model. Everything here is plain data (numbers, strings,
 * arrays, plain objects) so a world serialises to JSON and back without any
 * custom revivers. Cross references are ids, never object pointers.
 */
import type { RngState } from './rng'
import type { Attr, Facet, MindAttr, Need, NenType, Skill, Species, Tech, Value, BodyPart } from './constants'

export type Id = number

/* ================= People ================= */

export interface Rel {
  /** How much A likes B. -100..100 */
  aff: number
  /** Whether A believes B will do right by them. -100..100 */
  trust: number
  /** A's regard for B's strength or ability. -100..100 */
  resp: number
  /** 0..100 */
  fear: number
  /** Romantic attraction, 0..100 */
  attr: number
  /** How well A knows B, 0..100 */
  fam: number
  /** Favours B has done A that A has not repaid. Positive means A owes B. */
  debt: number
  /** Bitmask over BONDS. */
  bonds: number
  t0: number
  t: number
}

export interface Memory {
  t: number
  ev?: Id
  k: string
  who?: Id
  /** -100..100, how it felt. */
  val: number
  /** 0..100, fades with time. */
  str: number
  text: string
}

export type DreamKind =
  | 'hunter' // pass the Hunter Exam
  | 'find' // find a person
  | 'avenge' // kill a person, or wipe out an organisation
  | 'recover' // get back items of a kind (Scarlet Eyes)
  | 'strongest' // become as strong as possible
  | 'defeat' // beat one particular person
  | 'doctor' // become a doctor
  | 'protect' // keep one person safe
  | 'rule' // lead an organisation or nation
  | 'wealth' // amass a fortune
  | 'explore' // reach the Dark Continent
  | 'family' // marry and raise children
  | 'serve' // serve an organisation or a master
  | 'clear' // clear Greed Island
  | 'discover' // make a name in one's field (gourmet, beasts, ruins)
  | 'peace' // end a conflict without bloodshed
  | 'chaos' // make things interesting
  | 'free' // free someone (or oneself) from another's control
  | 'master' // master Nen and teach it
  | 'fame' // be known

export interface Dream {
  k: DreamKind
  /** Person, organisation, nation or place id, depending on kind. */
  target?: Id
  /** Item kind for 'recover', field for 'discover', etc. */
  tag?: string
  /** 0..100 */
  pri: number
  /** 0..100 */
  prog: number
  since: number
  done?: number
  failed?: number
  cause?: Id
}

export type ActKind =
  | 'idle' | 'rest' | 'train' | 'meditate' | 'work' | 'social' | 'leisure' | 'romance' | 'family' | 'study'
  | 'travel' | 'seek' | 'investigate' | 'guard' | 'hunt' | 'expedition' | 'heal' | 'teach' | 'crime' | 'mourn'
  | 'hide' | 'jail' | 'recover' | 'game' | 'duty' | 'wander' | 'arena' | 'scheme' | 'campaign' | 'swarm' | 'feed'

export interface Activity {
  k: ActKind
  /** A person this activity is with or about. */
  with?: Id
  until: number
  /** Free text for the sheet, e.g. "Training Ken under Biscuit". */
  note?: string
  /** Which technique or category is being trained. */
  focus?: string
}

/** A short-term intention: one step toward a dream or an order. */
export interface Intent {
  k: string
  target?: Id
  place?: Id
  until: number
  dream?: number
  ev?: Id
  why?: string
  data?: Record<string, unknown>
}

export interface Wound {
  part: BodyPart
  sev: 1 | 2 | 3
  t: number
  /** Days until healed. A permanent wound sits at 0 forever. */
  left: number
  bleed: boolean
  treated: boolean
  perm: boolean
  by?: Id
}

export type CondKind =
  | 'poison' | 'disease' | 'curse' | 'sealed' | 'jailed' | 'captive' | 'controlled' | 'pregnant' | 'exhausted'
  | 'unconscious' | 'hiding' | 'mourning' | 'contaminated' | 'aged' | 'blind' | 'zobae' | 'debt' | 'judgment' | 'wish'
  | 'burned' | 'frostbite' | 'radiation' | 'frenzied' | 'kept' | 'undying'

export interface Cond {
  k: CondKind
  until: number
  by?: Id
  /** Strength, or for 'judgment' the rule text. */
  p?: number
  note?: string
}

export interface Membership {
  org: Id
  rank: number
  t: number
  loyalty: number
  /** Infiltrators and spies. Only people who know the fact see through it. */
  secret?: boolean
  /** Phantom Troupe number, Zodiac sign, prince order... */
  num?: number
  title?: string
}

export interface Trip {
  from: Id
  to: Id
  t0: number
  t1: number
  mode: 'air' | 'sea' | 'land' | 'wing' | 'warp'
}

/* ================= Nen ================= */

export type EffectKind =
  | 'damage' | 'bind' | 'control' | 'debuff' | 'buff' | 'transform' | 'heal' | 'shield' | 'summon' | 'stealth'
  | 'teleport' | 'reveal' | 'steal' | 'seal' | 'contract' | 'drain' | 'speed' | 'sense' | 'curse' | 'debt'
  | 'absorb' | 'utility' | 'clone' | 'explode' | 'poison'

export interface Effect {
  k: EffectKind
  /** Relative power, 1 is an ordinary use of the effect. */
  p: number
  /** Exchanges the effect lasts in a fight. */
  dur?: number
  range?: 'self' | 'touch' | 'melee' | 'mid' | 'far' | 'area'
  /** For buff/debuff: which stat. For damage: element flavour. */
  stat?: string
  note?: string
}

export type HatsuCondKind =
  | 'touch_first' | 'explain' | 'named' | 'stillness' | 'target_only' | 'after_hit' | 'daylight' | 'once_per_target'
  | 'cooldown' | 'life_cost' | 'emotion' | 'item' | 'time_limit' | 'death_penalty' | 'self_harm' | 'consent' | 'sight'
  | 'zetsu_after' | 'charge' | 'aura_all' | 'close_range' | 'book_open' | 'game_rules'

export interface HatsuCond {
  k: HatsuCondKind
  stars: number
  text: string
  /** Target person ids or org id for target_only, item key for item, etc. */
  org?: Id
  people?: Id[]
  n?: number
}

export interface Hatsu {
  id: string
  name: string
  /** Who made it. */
  by: Id
  /** Who it was stolen from, when it sits in someone else's book. */
  from?: Id
  cats: [NenType, number][]
  /** Archetype key, e.g. 'strike', 'chain', 'puppet'. */
  kind: string
  effects: Effect[]
  conds: HatsuCond[]
  stars: number
  /** Quality of the idea and how well it suits its maker, ~0.8..1.4. */
  base: number
  desc: string
  t: number
  /** How many times used in fights, for flavour and mastery. */
  uses: number
  /** Not usable in a fight (prophecy, copying, healing others between fights...). */
  passive?: boolean
}

export interface Vow {
  t: number
  stars: number
  text: string
  person?: Id
  org?: Id
  /** Power multiplier against the target. */
  mult: number
  penalty: 'death' | 'nen' | 'life' | 'none'
  ev?: Id
  kept?: boolean
  broken?: boolean
}

export interface NenState {
  awake: boolean
  t?: number
  how?: 'innate' | 'slow' | 'forced' | 'trauma' | 'ant'
  type: NenType
  /** Has water divination been done. */
  known: boolean
  /** Talent: how fast they grow. ~0.3..1.8 */
  pot: number
  /** The level their talent can reach. */
  cap: number
  /** Nen level, 0..~120. The one-number summary of aura capacity and skill. */
  lvl: number
  /** Current aura, as a fraction of the maximum, 0..1. */
  aura: number
  tech: Record<Tech, number>
  /** En radius in metres. */
  enR: number
  /** Trained proficiency per category, 0..100, capped by efficiency. */
  cat: number[]
  hatsu: Hatsu[]
  /** Abilities taken from others (Skill Hunter). */
  stolen: Hatsu[]
  /** A canon character's ability before they have developed it. */
  destined?: HatsuSpec[]
  vows: Vow[]
  /** Days of life burned by abilities (Emperor Time, the Gon transformation). */
  lifeSpent: number
  /** Restriction-driven permanent loss (Gon after the transformation). */
  burnedOut?: boolean
}

/** Author-facing description of a Hatsu, compiled into a Hatsu. */
export interface HatsuSpec {
  name: string
  kind: string
  cats: [NenType, number][]
  effects: Effect[]
  conds?: HatsuCond[]
  base?: number
  desc: string
  passive?: boolean
  /** Nen level at which a canon character develops it. */
  at?: number
}

/* ================= Person ================= */

export interface Person {
  id: Id
  key?: string
  name: string
  short: string
  sex: 'm' | 'f'
  species: Species
  born: number
  alive: boolean
  death?: { t: number; at: Id; cause: string; by?: Id; ev?: Id }
  home: Id
  loc: Id
  trip?: Trip
  nation: Id
  orgs: Membership[]
  role: string
  title?: string
  canon: boolean
  major: boolean
  owned?: boolean
  portrait?: string
  look: { skin: number; hair: number; style: number; eyes: number; height: number }
  attrs: Record<Attr, number>
  mind: Record<MindAttr, number>
  facets: Record<Facet, number>
  values: Record<Value, number>
  orient: 'straight' | 'gay' | 'bi' | 'ace'
  needs: Record<Need, number>
  needW: Record<Need, number>
  mood: { happy: number; stress: number; fear: number; anger: number; grief: number }
  memories: Memory[]
  dreams: Dream[]
  plan: Intent | null
  act: Activity
  nextThink: number
  skills: Record<Skill, number>
  hp: number
  stam: number
  wounds: Wound[]
  conds: Cond[]
  nen: NenState
  /** Millions of Jenny. */
  jenny: number
  items: Id[]
  weapon: string
  fame: number
  infamy: number
  bounty: number
  rel: Record<number, Rel>
  /** Facts known: fact id -> day learned. */
  know: Record<number, number>
  /** Last known whereabouts of others: person id -> [place, day]. */
  seen: Record<number, [Id, number]>
  license?: { t: number; stars: number; field?: string }
  party?: Id
  stats: { wins: number; losses: number; kills: number; fights: number; spared: number; saved: number }
  life: Id[]
  flags: Record<string, number | string | boolean>
  lastFight: number
  /** Lifespan in years. */
  span: number
  bio?: string
}

/* ================= Places, nations, organisations ================= */

export interface Place {
  id: Id
  key: string
  name: string
  nation: Id
  x: number
  y: number
  kind: 'city' | 'town' | 'village' | 'wild' | 'landmark' | 'island' | 'fortress' | 'ship' | 'beyond'
  /** Thousands of residents, as an abstract population. */
  pop: number
  danger: number
  wealth: number
  airport: boolean
  port: boolean
  hospital: number
  features: string[]
  owner?: Id
  /** The worst hazard here, 0..1, kept for quick checks; the full list is
   *  in `hazards`. */
  hazard: number
  hazardUntil: number
  hazardKind?: string
  hazards?: Hazard[]
  /** What the place was like before a disaster, so it can recover. */
  base?: { pop: number; wealth: number }
  unrest: number
  /** Who controls it in a war, if not its own nation. */
  occupier?: Id
  hidden?: boolean
  region: string
  desc?: string
}

export interface Hazard {
  k: import('../data/hazards').HazardKind
  sev: number
  t: number
  /** The disaster or event that caused it. */
  ev?: Id
  /** For calamities: which one. */
  cal?: string
  /** Helpers who have worked on it, for credit. */
  helped?: number
}

export interface NationRel {
  op: number
  ally: boolean
  nap: boolean
  trade: boolean
  sanction: boolean
}

export interface Nation {
  id: Id
  key: string
  name: string
  short: string
  gov: 'monarchy' | 'empire' | 'republic' | 'federation' | 'union' | 'dictatorship' | 'autonomous' | 'stateless' | 'kingdom'
  ruler: Id
  rulerTitle: string
  capital: Id
  /** Millions. */
  pop: number
  /** Economy index, roughly GDP in trillions of Jenny. */
  gdp: number
  /** Billions of Jenny on hand. */
  treasury: number
  tech: number
  stability: number
  traits: { militarism: number; expansion: number; isolation: number; corruption: number; ruthless: number }
  mil: { troops: number; armor: number; air: number; navy: number; readiness: number; morale: number; nen: Id[] }
  arsenal: { roses: number; missiles: number; bio: number }
  rel: Record<number, NationRel>
  blocs: string[]
  color: string
  weariness: number
  flags: Record<string, number | string | boolean>
  desc?: string
}

export interface Rule {
  key: string
  /** Article or rule number as shown. */
  n: string
  text: string
  note?: string
}

export interface OrgOp {
  k: string
  target?: Id
  place?: Id
  due: number
  start: number
  members: Id[]
  ev?: Id
  data?: Record<string, unknown>
}

export interface Org {
  id: Id
  key: string
  name: string
  short: string
  kind: 'association' | 'gang' | 'family' | 'clan' | 'royal' | 'military' | 'mafia' | 'swarm' | 'arena' | 'company' | 'team' | 'bloc' | 'school' | 'cult'
  leader: Id
  hq: Id
  nation: Id
  color: string
  ranks: string[]
  treasury: number
  rep: number
  rules: Rule[]
  ops: OrgOp[]
  tension: Record<number, number>
  founded: number
  dead?: boolean
  secret?: boolean
  flags: Record<string, number | string | boolean>
  /** Recent rule enforcement, newest last. */
  rulesLog: { t: number; rule: string; who: Id; outcome: string; ev?: Id }[]
  desc?: string
  /** Cap on members (the Troupe has 13 seats). */
  seats?: number
}

export interface Party {
  id: Id
  members: Id[]
  leader: Id
  purpose: string
  dream?: { k: DreamKind; target?: Id }
  t: number
  until: number
}

export interface Front {
  place: Id
  /** Strength committed by each side, in "division equivalents". */
  a: number
  d: number
  held: 'a' | 'd'
}

export interface War {
  id: Id
  /** Nation ids, or organisation ids when `factions` is true. */
  a: Id[]
  d: Id[]
  factions: boolean
  name: string
  cause?: Id
  goal: string
  start: number
  end?: number
  outcome?: string
  fronts: Front[]
  /** -100 (defenders winning) .. 100 (attackers winning) */
  score: number
  dead: [number, number]
  /** Civilian deaths, thousands. */
  civ: number
  ev?: Id
  roseUsed?: boolean
}

/* ================= Knowledge, items, contracts ================= */

export type FactKind = 'ability' | 'crime' | 'identity' | 'member' | 'item' | 'plan' | 'secret' | 'weakness' | 'rumor' | 'type'

export interface Fact {
  id: Id
  k: FactKind
  /** Subject (usually a person). */
  s: Id
  /** Object (victim, org, item...). */
  o?: Id
  /** Hatsu id for 'ability', free key otherwise. */
  d?: string
  t: number
  truth: boolean
  /** 0..1, how hard people try to keep it quiet. */
  secret: number
  imp: number
  text: string
  ev?: Id
}

export interface Item {
  id: Id
  k: string
  name: string
  holder: Id
  /** Place it is kept, when no one carries it. */
  place?: Id
  /** Millions of Jenny. */
  value: number
  data?: Record<string, unknown>
}

export interface Contract {
  id: Id
  k: 'assassination' | 'bodyguard' | 'bounty' | 'retrieval' | 'investigation' | 'escort'
  /** Person id of the client, or -orgId-1 for an organisation. */
  client: number
  target?: Id
  place?: Id
  reward: number
  posted: number
  expires: number
  taker?: Id
  status: 'open' | 'taken' | 'done' | 'failed' | 'void'
  ev?: Id
  why?: string
}

/* ================= History ================= */

export interface HistEvent {
  id: Id
  t: number
  type: string
  /** 0 trivial .. 5 world-changing */
  imp: number
  text: string
  who: Id[]
  at?: Id
  orgs?: Id[]
  nats?: Id[]
  cause?: Id
  story?: Id
  data?: Record<string, unknown>
}

export interface Storyline {
  id: Id
  k: string
  title: string
  who: Id[]
  t0: number
  t1?: number
  status: 'active' | 'resolved'
  ev: Id[]
  heat: number
  outcome?: string
  key?: string
}

/* ================= Player ================= */

export interface CrossroadOption {
  k: string
  label: string
  desc: string
  /** How well it fits the character's nature, 0..1. Low means they may refuse. */
  fit: number
}

export interface Crossroad {
  id: Id
  pid: Id
  t: number
  title: string
  prompt: string
  options: CrossroadOption[]
  expires: number
  chosen?: string
  refused?: boolean
  ctx: Record<string, unknown>
}

export interface PlayerState {
  owned: Id[]
  follow: Id
  watch: Id[]
  /** Points for nudging the world, earned over time. */
  influence: number
  tier: string
  crossroads: Crossroad[]
  /** Everything the player did, so a world can be replayed from its seed. */
  log: { t: number; k: string; data: Record<string, unknown> }[]
  settings: { pause: boolean; autoChoose: boolean }
  nextId: number
  hunterPoints: number
  predictions: { id: Id; t: number; k: string; subject: Id; pick: Id; resolved?: boolean; right?: boolean; label: string }[]
}

/* ================= World ================= */

export interface Laws {
  lethality: number
  vowPower: number
  growth: number
  healing: number
  postmortem: boolean
  wars: boolean
  plotArmor: boolean
  romance: boolean
  calamities: boolean
  /** Earthquakes, floods, fires, plagues. */
  disasters?: boolean
  /** Expeditions beyond the lake, legal and otherwise. */
  expeditions?: boolean
}

export interface World {
  version: number
  seed: number
  epoch: number
  t: number
  rng: RngState
  era: string
  people: Person[]
  places: Place[]
  nations: Nation[]
  orgs: Org[]
  parties: Party[]
  wars: War[]
  facts: Fact[]
  items: Item[]
  contracts: Contract[]
  events: HistEvent[]
  nextEv: number
  stories: Storyline[]
  laws: Laws
  flags: Record<string, any>
  player: PlayerState
  counters: Record<string, number>
  /** Events created during the current tick, for the interface to pick up. */
  fresh: Id[]
  /** The Dark Continent as this world has it: canonical calamities plus the
   *  unrecorded ones it rolled, and what humanity has learned. */
  dc?: DcState
  /** Every expedition beyond the lake, past and present. */
  expeditions?: ExpeditionRun[]
  nextFact: number
  nextItem: number
}

export interface DcState {
  calamities: import('../data/darkcontinent').CalamityDef[]
  regions: import('../data/darkcontinent').RegionDef[]
  /** Calamity key to the fact that describes it, once anyone knows. */
  facts: Record<string, Id>
  /** Hope key to how many have been brought back in this world's history. */
  hopes: Record<string, number>
  /** How many illegal attempts the V5 know about, and how many returned. */
  attempts: number
  returned: number
}

export type ExpeditionStage = 'gathering' | 'crossing' | 'exploring' | 'returning' | 'home' | 'lost' | 'turned_back' | 'caught'

export interface ExpeditionRun {
  id: Id
  name: string
  leader: Id
  members: Id[]
  /** Who paid. */
  sponsor?: { nation?: Id; org?: Id; person?: Id }
  legal: boolean
  port: Id
  stage: ExpeditionStage
  t0: number
  /** When the current stage's next step is due. */
  next: number
  /** What they are after: a calamity's region, or nothing in particular. */
  goal?: string
  /** Where they are on the Dark Continent, as a region key. */
  region?: string
  /** Weeks spent beyond the lake. */
  weeks: number
  supplies: number
  morale: number
  /** Hope keys found, and calamity keys met. */
  found: string[]
  met: string[]
  /** Calamities someone is carrying home without knowing. */
  carried: string[]
  dead: Id[]
  ev: Id
  /** Final outcome line, once over. */
  end?: string
  endT?: number
  /** When the ship reaches the far side, and whether the halfway point has passed. */
  arrive?: number
  halfway?: boolean
  /** Weeks of walking left before they reach their goal. */
  walk?: number
  flags?: Record<string, number>
}
