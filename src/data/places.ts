/**
 * Places. Positions follow the official world map (see geography.ts). Populations are
 * abstract, in thousands. `features` drive what people can do there:
 * 'exam' hosts the Hunter Exam, 'auction' the Yorknew auction, 'dojo' makes
 * training better, 'wild' is where Beast and Gourmet Hunters work, 'casino'
 * and 'market' are where money changes hands, 'palace' seats a ruler.
 */
export interface PlaceDef {
  key: string
  name: string
  nation: string
  x: number
  y: number
  kind: 'city' | 'town' | 'village' | 'wild' | 'landmark' | 'island' | 'fortress' | 'ship' | 'beyond'
  pop: number
  danger: number
  wealth: number
  airport?: boolean
  port?: boolean
  hospital?: number
  features?: string[]
  hidden?: boolean
  region: string
  desc: string
}

export const PLACES: PlaceDef[] = [
  { key: 'whale', name: 'Whale Island', nation: 'free', x: 52.2, y: 11.0, kind: 'island', pop: 3, danger: 0.15, wealth: 0.2, port: true, hospital: 0, features: ['wild', 'fishing', 'quiet'], region: 'Lake Mobius', desc: 'A small fishing island with a forest full of animals. Gon grew up here.' },
  { key: 'dolle', name: 'Dolle Harbor', nation: 'kukanyu', x: 22.8, y: 33.6, kind: 'city', pop: 400, danger: 0.25, wealth: 0.45, port: true, airport: true, hospital: 1, features: ['market', 'harbor'], region: "Kingdom of Kukan'yu", desc: 'The harbour candidates land at on their way to the Exam. The Navigator lives on the road beyond it.' },
  { key: 'zaban', name: 'Zaban City', nation: 'kukanyu', x: 24.3, y: 32.5, kind: 'city', pop: 2200, danger: 0.2, wealth: 0.6, airport: true, hospital: 2, features: ['exam', 'market'], region: "Kingdom of Kukan'yu", desc: 'Behind a steakhouse in this city is the entrance to the 287th Hunter Exam.' },
  { key: 'kukanyu', name: "Kukan'yu Royal Capital", nation: 'kukanyu', x: 20.0, y: 27.5, kind: 'city', pop: 3100, danger: 0.12, wealth: 0.7, airport: true, port: true, hospital: 2, features: ['palace', 'market', 'library'], region: "Kingdom of Kukan'yu", desc: 'Seat of the Kingdom of Kukan\'yu, one of the founding V5 nations.' },
  { key: 'lukso', name: 'Lukso Forest', nation: 'kukanyu', x: 17.0, y: 17.0, kind: 'wild', pop: 0, danger: 0.35, wealth: 0.05, features: ['wild', 'ruins', 'graves'], region: 'Lukso Province', desc: 'The forest where the Kurta clan lived until the Phantom Troupe killed them all.' },
  { key: 'wastes', name: 'Northern Wastes', nation: 'kukanyu', x: 16.4, y: 11.0, kind: 'wild', pop: 1, danger: 0.55, wealth: 0.1, features: ['wild', 'beasts'], region: "Kingdom of Kukan'yu", desc: 'Cold, empty country where Beast Hunters go to find animals nobody has named.' },

  { key: 'dentora', name: 'Dentora Region', nation: 'padokea', x: 26.8, y: 12.2, kind: 'town', pop: 180, danger: 0.25, wealth: 0.4, airport: true, hospital: 1, features: ['tourism', 'market'], region: 'Republic of Padokea', desc: 'Sightseeing buses leave from here for the Testing Gate of the Zoldyck estate.' },
  { key: 'kukuroo', name: 'Kukuroo Mountain', nation: 'padokea', x: 28.5, y: 9.9, kind: 'landmark', pop: 1, danger: 0.75, wealth: 0.9, features: ['estate', 'wild', 'dojo'], region: 'Republic of Padokea', desc: 'A dead volcano and the private estate of the Zoldyck family of assassins. The Testing Gate weighs two tonnes a door.' },
  { key: 'arena', name: 'Heavens Arena', nation: 'padokea', x: 46.0, y: 16.7, kind: 'landmark', pop: 120, danger: 0.3, wealth: 0.7, airport: true, hospital: 2, features: ['arena', 'dojo', 'casino'], region: 'Republic of Padokea', desc: 'A 251-floor fighting tower. Below the 200th floor fighters win money. Above it, everyone uses Nen.' },
  { key: 'swardani', name: 'Swardani City', nation: 'mimbo', x: 34.7, y: 13.3, kind: 'city', pop: 2600, danger: 0.08, wealth: 0.75, airport: true, port: true, hospital: 3, features: ['hq', 'library', 'market', 'prison', 'palace'], region: 'Mimbo Republic', desc: 'Headquarters of the Hunter Association, and the capital of Mimbo.' },
  { key: 'mimbo_hills', name: 'Mimbo Highlands', nation: 'mimbo', x: 28.5, y: 17.6, kind: 'wild', pop: 20, danger: 0.3, wealth: 0.2, features: ['wild', 'dojo', 'quiet'], region: 'Mimbo Republic', desc: 'Mountain temples and quiet valleys. Masters come here to train students away from crowds.' },

  { key: 'yorknew', name: 'Yorknew City', nation: 'saherta', x: 17.2, y: 49.6, kind: 'city', pop: 14000, danger: 0.35, wealth: 0.95, airport: true, port: true, hospital: 3, features: ['auction', 'market', 'casino', 'mafia', 'library'], region: 'Yorbian continent', desc: 'The richest city in the world. Every September the underground auction fills its vaults.' },
  { key: 'saherta', name: 'Saherta Federal Capital', nation: 'saherta', x: 28.7, y: 46.7, kind: 'city', pop: 5200, danger: 0.12, wealth: 0.85, airport: true, hospital: 3, features: ['palace', 'military', 'library'], region: 'Yorbian continent', desc: 'Capital of the United States of Saherta, the strongest of the V5.' },
  { key: 'glamgas', name: 'Glam Gas Land', nation: 'saherta', x: 26.4, y: 41.4, kind: 'city', pop: 900, danger: 0.3, wealth: 0.8, airport: true, hospital: 1, features: ['casino', 'market'], region: 'Yorbian continent', desc: 'A city of casinos and dealmakers on the northern Yorbian coast.' },
  { key: 'gordeau', name: 'Gordeau Desert', nation: 'saherta', x: 19.8, y: 47.6, kind: 'wild', pop: 0, danger: 0.45, wealth: 0.05, features: ['wild', 'desert'], region: 'Yorbian continent', desc: 'Dry country south of Yorknew. Good for things that should not be found.' },
  { key: 'meteor', name: 'Meteor City', nation: 'none', x: 22.7, y: 53.0, kind: 'city', pop: 8000, danger: 0.6, wealth: 0.1, features: ['slums', 'junk', 'hidden'], hidden: true, region: 'Yorbian continent', desc: 'A city that is on no map. Eight million people live off the world\'s garbage, and nobody there has a record. The Phantom Troupe came from here.' },

  { key: 'ngl', name: 'NGL Autonomous Region', nation: 'ngl', x: 37.6, y: 69.0, kind: 'wild', pop: 120, danger: 0.55, wealth: 0.3, features: ['wild', 'jungle', 'drugs'], region: 'Balsa Islands', desc: 'Neo-Green Life: a nation that renounced machines and modern medicine. Underneath, Gyro\'s drug empire.' },
  { key: 'rokario', name: 'Rokario', nation: 'rokario', x: 38.2, y: 68.2, kind: 'village', pop: 40, danger: 0.3, wealth: 0.2, port: true, hospital: 0, features: ['coast', 'quiet'], region: 'Balsa Islands', desc: 'A small coastal republic. Anything the lake washes up lands on its beaches first.' },
  { key: 'peijin', name: 'Peijin', nation: 'egorteau', x: 40.1, y: 66.3, kind: 'city', pop: 1800, danger: 0.5, wealth: 0.35, airport: true, port: true, hospital: 1, features: ['palace', 'military', 'gungi'], region: 'Balsa Islands', desc: 'Capital of the Republic of East Gorteau. The palace of the Supreme Leader stands at its centre.' },
  { key: 'wgorteau', name: 'West Gorteau', nation: 'wgorteau', x: 39.0, y: 67.2, kind: 'town', pop: 600, danger: 0.25, wealth: 0.35, port: true, hospital: 1, features: ['market'], region: 'Balsa Islands', desc: 'The Republic of West Gorteau, which shares a language and a grudge with the East.' },

  { key: 'greed', name: 'Greed Island', nation: 'none', x: 62.8, y: 53.0, kind: 'island', pop: 2, danger: 0.6, wealth: 0.6, features: ['game', 'wild'], hidden: true, region: 'Lake Mobius', desc: 'A real island where a Nen game runs. Players enter through a console, collect cards, and die for real.' },
  { key: 'begerosse', name: 'Begerossé Capital', nation: 'begerosse', x: 76.3, y: 59.9, kind: 'city', pop: 3300, danger: 0.15, wealth: 0.75, airport: true, port: true, hospital: 2, features: ['palace', 'military'], region: 'Begerossé', desc: 'Capital of the Begerossé Union, a V5 founder. Its own expedition once returned with almost no one.' },
  { key: 'begerosse_reef', name: 'Begerossé Reef', nation: 'begerosse', x: 73.5, y: 66.5, kind: 'wild', pop: 0, danger: 0.4, wealth: 0.1, features: ['wild', 'sea', 'beasts'], region: 'Begerossé', desc: 'Warm shallows full of creatures Sea Hunters would like named after them.' },
  { key: 'ochima', name: 'Ochima Capital', nation: 'ochima', x: 104.0, y: 48.0, kind: 'city', pop: 2600, danger: 0.15, wealth: 0.7, airport: true, port: true, hospital: 2, features: ['palace', 'military', 'market'], region: 'Ochima', desc: 'Capital of the Ochima Federation, a V5 founder.' },

  { key: 'kakin', name: 'Kakin Imperial Capital', nation: 'kakin', x: 98.7, y: 29.3, kind: 'city', pop: 26000, danger: 0.3, wealth: 0.8, airport: true, hospital: 3, features: ['palace', 'military', 'market', 'library', 'collectors'], region: 'Azian continent', desc: 'Seat of King Nasubi Hui Guo Rou and his fourteen children. A rising empire that wants a seat at the top table.' },
  { key: 'kakinport', name: 'Black Whale Harbor', nation: 'kakin', x: 84.0, y: 28.4, kind: 'town', pop: 700, danger: 0.25, wealth: 0.6, port: true, airport: true, hospital: 1, features: ['harbor', 'shipyard'], region: 'Azian continent', desc: 'Where the great ship Black Whale No. 1 is being built.' },
  { key: 'azian_ruins', name: 'Azian Ruins', nation: 'kakin', x: 100.0, y: 16.7, kind: 'wild', pop: 2, danger: 0.45, wealth: 0.2, features: ['ruins', 'wild'], region: 'Azian continent', desc: 'Cities older than any nation still standing. Ruins Hunters dig here.' },
  { key: 'jappon', name: 'Jappon', nation: 'jappon', x: 35.7, y: 27.0, kind: 'city', pop: 1300, danger: 0.15, wealth: 0.55, airport: true, port: true, hospital: 2, features: ['dojo', 'ninja', 'market'], region: 'Jappon', desc: 'An island nation with shrines, ninja villages and its own old martial traditions.' },

  { key: 'blackwhale', name: 'Black Whale No. 1', nation: 'kakin', x: 82.4, y: 29.6, kind: 'ship', pop: 200, danger: 0.4, wealth: 0.8, hospital: 2, features: ['ship', 'palace'], hidden: true, region: 'Lake Mobius', desc: 'The largest ship ever built, carrying two hundred thousand passengers, five tiers of class, fourteen princes and their guards toward the Dark Continent.' },
  { key: 'dc_shore', name: 'Dark Continent shore', nation: 'none', x: 64.0, y: -4.0, kind: 'beyond', pop: 0, danger: 0.98, wealth: 0.0, features: ['dc', 'wild', 'calamity'], hidden: true, region: 'Outside Lake Mobius', desc: 'The edge of the world humans live in. Five expeditions went in. Almost no one came back, and what did come back was worse.' },
]
