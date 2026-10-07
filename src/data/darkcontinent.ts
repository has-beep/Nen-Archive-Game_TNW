/**
 * The Dark Continent: everything outside Lake Mobius.
 *
 * The known world sits inside an enormous lake. Everything beyond it is the
 * Dark Continent, where five expeditions in recorded history came back,
 * each carrying one treasure (a "hope") and one calamity. The Inviolability
 * Treaty has banned travel there for two hundred years; illegal attempts
 * have mostly ended in nobody coming back.
 *
 * The five canonical calamities and their hopes follow the manga (chapters
 * 341-345). Fan translations differ on some names; these are the commonest
 * English forms. Each world also rolls a handful of calamities nobody has
 * ever recorded, in regions nobody has mapped.
 */

export type CalamityMode =
  /** Fights anyone who comes close to what it guards. */
  | 'guardian'
  /** Takes people away and keeps them. */
  | 'abduct'
  /** Its bite turns people on each other. */
  | 'frenzy'
  /** A living gas that grants wishes and takes payment. */
  | 'gas'
  /** A disease. */
  | 'plague'

export type HopeUse = 'energy' | 'cure' | 'longevity' | 'water' | 'alchemy' | 'nen' | 'weapon'

export interface HopeDef {
  key: string
  name: string
  desc: string
  use: HopeUse
  /** Millions of Jenny, if anyone were mad enough to sell it. */
  value: number
}

export interface CalamityDef {
  key: string
  name: string
  title: string
  mode: CalamityMode
  /** Threat class as the V5 and the Association rate it. */
  threat: string
  region: string
  desc: string
  /** What the expedition that met it went through. */
  history?: string
  /** Fight strength when it fights (guardian), or how deadly it is otherwise, 0..1. */
  power: number
  /** What it does if someone carries it home. */
  leak: string
  hope: HopeDef
  canon: boolean
}

export interface RegionDef {
  key: string
  name: string
  x: number
  y: number
  desc: string
  /** Weeks of travel from the shore, through country that kills. */
  depth: number
  danger: number
}

/** Where expeditions land, and the regions beyond. Coordinates sit at the
 *  very edges of the lake map; the interface draws them past its rim. */
export const DC_REGIONS: RegionDef[] = [
  { key: 'dc_northeast', name: 'The North-Eastern Mountains', x: 117, y: 2, depth: 6, danger: 0.85, desc: 'A mountain range nobody has climbed and come back to describe. Something up there keeps people.' },
  { key: 'dc_ruins', name: 'The Ruined City of the North Shore', x: 60, y: 1, depth: 4, danger: 0.8, desc: 'An ancient city on the north shore of Lake Mobius, older than every nation inside the lake, and still guarded.' },
  { key: 'dc_swamp', name: 'The Southern Swamps', x: 70, y: 75, depth: 5, danger: 0.9, desc: 'Swamps south of the lake where a cereal grows that might let a man live for centuries, and where the snakes have two tails.' },
  { key: 'dc_southeast', name: 'The South-Eastern Haze', x: 117, y: 74, depth: 7, danger: 0.9, desc: 'A region always half-hidden in a shining haze. The haze is alive.' },
  { key: 'dc_southshore', name: 'The South Shore', x: 28, y: 75, depth: 3, danger: 0.85, desc: 'Where Beyond Netero once landed, found a plant that turns things to gold, and brought something terrible home.' },
]

export const CALAMITIES: CalamityDef[] = [
  {
    key: 'pap', name: 'Pap', title: 'the Human-Keeping Beast', mode: 'abduct', threat: 'B', region: 'dc_northeast', canon: true, power: 0.55,
    desc: 'A beast that eats people, and likes to keep some of them alive as pets.',
    history: 'It took most of the expedition that found its mountain. A few of its pets have turned up inside the lake, years later, changed.',
    leak: 'People start to go missing near the port the expedition came home to.',
    hope: { key: 'unmanned_rock', name: 'Unmanned Rock', use: 'energy', value: 40000, desc: 'A mineral that makes electricity when it is put in water. A piece the size of a fist powers a city.' },
  },
  {
    key: 'brion', name: 'Brion', title: 'the Weapon', mode: 'guardian', threat: 'A', region: 'dc_ruins', canon: true, power: 0.97,
    desc: 'Something that guards the ruins on the north shore. It wiped out an armed expedition with no apparent effort. Ging Freecss rates it A; the Association\'s official file says B+.',
    history: 'Two of the expedition came back.',
    leak: 'Something follows the survivors home and starts killing the people who brought it.',
    hope: { key: 'cure_all', name: 'Herb for All Illnesses', use: 'cure', value: 60000, desc: 'A plant from the ruined city that cures any disease known, and several nobody has named.' },
  },
  {
    key: 'hellbell', name: 'Hellbell', title: 'the Twin-Tailed Snake', mode: 'frenzy', threat: 'B+', region: 'dc_swamp', canon: true, power: 0.8,
    desc: 'A snake with two tails. Its bite fills its prey with the need to kill whoever is next to them.',
    history: 'The Ochima Federation\'s expedition lost ninety-nine in every hundred. Eleven came back.',
    leak: 'A madness spreads through the port where the survivors land: ordinary people turning on each other.',
    hope: { key: 'nitro_rice', name: 'Nitro Rice', use: 'longevity', value: 50000, desc: 'A cereal from the southern swamps said to let a person live far past any human limit. Ging thinks it is why Don Freecss might still be alive.' },
  },
  {
    key: 'ai', name: 'Ai', title: 'the Gas Lifeform', mode: 'gas', threat: 'A', region: 'dc_southeast', canon: true, power: 0.85,
    desc: 'A gas that is alive. It grants what people want, and what it takes in return leaves bodies twisted like wrung cloth. The thing inside Alluka Zoldyck is said to be related.',
    history: 'The fourth expedition. Some of what came home with it is still inside the lake.',
    leak: 'A shining haze settles over the port. People make wishes into it, and pay.',
    hope: { key: 'trinity_elixir', name: 'Trinity Elixir', use: 'water', value: 45000, desc: 'The mother of all liquids. A drop of it makes clean water without end.' },
  },
  {
    key: 'zobae', name: 'Zobae', title: 'the Immortality Disease', mode: 'plague', threat: 'A', region: 'dc_southshore', canon: true, power: 0.9,
    desc: 'A disease that kills almost everyone who catches it. The one known survivor cannot die, and has not been himself for fifty years. He is kept in a basement under the V5\'s agency.',
    history: 'Beyond Netero\'s expedition. Most of the infected died within days.',
    leak: 'The disease comes ashore with the survivors and starts moving through the port.',
    hope: { key: 'metallion', name: 'Metallion', use: 'alchemy', value: 80000, desc: 'The alchemy plant. Where it grows, ordinary matter turns into precious metal.' },
  },
]

/* ---------------- Calamities nobody has recorded ---------------- */

const UNKNOWN_PLACES = ['the Glass Steppe', 'the Weeping Forest', 'the Pale Archipelago', 'the Bone Coast', 'the Hollow Mountains', 'the Sunken Plain', 'the Singing Desert', 'the Red Fjords', 'the Hanging Valley', 'the Ash Sea']
const UNKNOWN_THINGS: [string, string, CalamityMode, string][] = [
  ['Mother of Lanterns', 'a swarm of lights that leads travellers into the dark and does not let them out', 'abduct', 'Lights are seen in the streets of the port at night, and people follow them.'],
  ['the Grey Choir', 'a sound that makes everyone who hears it turn on their companions', 'frenzy', 'Some nights the port fills with singing, and in the morning there are bodies.'],
  ['Vessel', 'a thing of stone and joints that kills whatever comes near the place it stands', 'guardian', 'Something that walks like stone comes up out of the harbour.'],
  ['the Weeping Rot', 'a mould that grows on the living and makes them weep it onto others', 'plague', 'A mould starts growing on people in the port, and spreading.'],
  ['Mirror Silt', 'a dust that copies whatever breathes it and walks away as them', 'gas', 'People in the port start meeting themselves in the street.'],
  ['the Patient', 'a creature that waits under the sand for years for one meal, and then moves very fast', 'guardian', 'Something has followed the survivors home and buried itself near the port.'],
  ['Ninefold Moth', 'moths whose scales make people forget why they are afraid', 'frenzy', 'Moths are thick in the port, and nobody is afraid of anything any more.'],
  ['the Tithe', 'a fever that only kills one in ten, and chooses carefully', 'plague', 'A fever comes ashore that kills one person in ten and leaves the rest unable to sleep.'],
]
const UNKNOWN_HOPES: [string, string, HopeDef['use']][] = [
  ['Starwater', 'Water that holds light. A cup of it keeps a lamp burning for a year.', 'energy'],
  ['Thousand-Year Moss', 'A moss that, eaten, slows ageing almost to stopping.', 'longevity'],
  ['Heartwood Resin', 'A resin that closes any wound and regrows what was cut away.', 'cure'],
  ['Wellspring Pearl', 'A pearl that makes fresh water wherever it is dropped.', 'water'],
  ['Aura Coral', 'Coral that holds aura like a battery. Whoever carries it grows stronger in Nen.', 'nen'],
  ['Sunsteel', 'An ore that, worked into a weapon, cuts through anything the lake has ever made.', 'weapon'],
  ['Mint Grass', 'A grass whose roots draw silver up out of the earth.', 'alchemy'],
]

/** A world's unrecorded calamities: different in every world, unknown to
 *  everyone until someone meets one and lives. */
export function rollUnknowns(pick: <T>(a: T[]) => T, int: (n: number) => number): { regions: RegionDef[]; calamities: CalamityDef[] } {
  const n = 3 + int(3)
  const places = UNKNOWN_PLACES.slice()
  const things = UNKNOWN_THINGS.slice()
  const hopes = UNKNOWN_HOPES.slice()
  const regions: RegionDef[] = []
  const calamities: CalamityDef[] = []
  const edge: [number, number][] = [[2, 2], [2, 38], [118, 38], [40, 1], [90, 1], [45, 75], [95, 75], [2, 55]]
  for (let i = 0; i < n && places.length && things.length; i++) {
    const pn = places.splice(int(places.length), 1)[0]
    const [tn, td, mode, leak] = things.splice(int(things.length), 1)[0]
    const [hn, hd, hu] = hopes.length ? hopes.splice(int(hopes.length), 1)[0] : pick(UNKNOWN_HOPES)
    const [x, y] = edge[i % edge.length]
    const key = `dc_u${i}`
    regions.push({ key, name: pn[0].toUpperCase() + pn.slice(1), x, y, depth: 4 + int(6), danger: 0.8 + int(15) / 100, desc: 'Nobody inside the lake has ever mapped it.' })
    calamities.push({
      key: `u${i}`, name: tn[0].toUpperCase() + tn.slice(1), title: 'an unrecorded calamity', mode, threat: '?', region: key, canon: false,
      power: 0.6 + int(35) / 100, desc: td[0].toUpperCase() + td.slice(1) + '.', leak,
      hope: { key: `uhope${i}`, name: hn, desc: hd, use: hu, value: 20000 + int(40) * 1000 },
    })
  }
  return { regions, calamities }
}
