/**
 * Nations. The V5 (Kukan'yu, Saherta, Ochima, Mimbo, Begerossé) are the five
 * leading powers, bound since about 200 years ago by the Inviolability Treaty
 * never to travel to the Dark Continent. Kakin is outside it: thirty years ago
 * it became, technically, a new nation and never renewed the treaty. If Kakin
 * forces the issue, the bloc can admit it and become the V6.
 *
 * The Poor Man's Rose is a miniature bomb that kills by blast and then by the
 * poison it spreads. Producing it is banned by treaty, but nobody ever
 * destroyed the existing stock. Who holds how many is a guess, kept here as a
 * secret number per nation.
 *
 * Military numbers are abstract: troops in thousands, armour/air/navy as
 * relative strength indices.
 */
export interface NationDef {
  key: string
  name: string
  short: string
  gov: 'monarchy' | 'empire' | 'republic' | 'federation' | 'union' | 'dictatorship' | 'autonomous' | 'stateless' | 'kingdom'
  rulerTitle: string
  capital: string
  pop: number
  gdp: number
  tech: number
  stability: number
  traits: { militarism: number; expansion: number; isolation: number; corruption: number; ruthless: number }
  mil: { troops: number; armor: number; air: number; navy: number }
  arsenal: { roses: number; missiles: number; bio: number }
  blocs: string[]
  color: string
  desc: string
}

export const NATIONS: NationDef[] = [
  {
    key: 'kakin', name: 'Kakin Empire', short: 'Kakin', gov: 'empire', rulerTitle: 'King', capital: 'kakin', pop: 1500, gdp: 22, tech: 0.75, stability: 70,
    traits: { militarism: 75, expansion: 85, isolation: 20, corruption: 55, ruthless: 70 }, mil: { troops: 3200, armor: 70, air: 65, navy: 60 }, arsenal: { roses: 5, missiles: 80, bio: 3 },
    blocs: [], color: '#d4a72c', desc: 'The fastest-growing power in the world, ruled by King Nasubi Hui Guo Rou. It wants the Dark Continent, and it wants the respect of the V5.',
  },
  {
    key: 'saherta', name: 'United States of Saherta', short: 'Saherta', gov: 'republic', rulerTitle: 'President', capital: 'saherta', pop: 420, gdp: 30, tech: 0.92, stability: 75,
    traits: { militarism: 70, expansion: 45, isolation: 25, corruption: 35, ruthless: 50 }, mil: { troops: 1400, armor: 90, air: 95, navy: 90 }, arsenal: { roses: 12, missiles: 120, bio: 2 },
    blocs: ['V5'], color: '#3f6fb5', desc: 'The strongest of the V5. Its expedition to the Dark Continent met the weapon called Brion: two of two hundred came home.',
  },
  {
    key: 'kukanyu', name: "Kingdom of Kukan'yu", short: "Kukan'yu", gov: 'kingdom', rulerTitle: 'Queen', capital: 'kukanyu', pop: 210, gdp: 9, tech: 0.78, stability: 80,
    traits: { militarism: 40, expansion: 25, isolation: 35, corruption: 30, ruthless: 30 }, mil: { troops: 420, armor: 45, air: 50, navy: 55 }, arsenal: { roses: 3, missiles: 30, bio: 0 },
    blocs: ['V5'], color: '#2d8f4e', desc: 'A V5 founder on the northern continent. The Hunter Exam is often held in its cities.',
  },
  {
    key: 'ochima', name: 'Ochima Federation', short: 'Ochima', gov: 'federation', rulerTitle: 'Chancellor', capital: 'ochima', pop: 260, gdp: 11, tech: 0.82, stability: 78,
    traits: { militarism: 50, expansion: 35, isolation: 30, corruption: 35, ruthless: 40 }, mil: { troops: 700, armor: 55, air: 60, navy: 65 }, arsenal: { roses: 4, missiles: 50, bio: 1 },
    blocs: ['V5'], color: '#7a4fd6', desc: 'A V5 founder in the far south-east. Careful, wealthy and well armed.',
  },
  {
    key: 'mimbo', name: 'Mimbo Republic', short: 'Mimbo', gov: 'republic', rulerTitle: 'Premier', capital: 'swardani', pop: 180, gdp: 8, tech: 0.8, stability: 82,
    traits: { militarism: 35, expansion: 20, isolation: 30, corruption: 25, ruthless: 30 }, mil: { troops: 500, armor: 40, air: 45, navy: 40 }, arsenal: { roses: 3, missiles: 25, bio: 0 },
    blocs: ['V5'], color: '#2e7d9a', desc: 'A V5 founder, and host of the Hunter Association\'s headquarters in Swardani City.',
  },
  {
    key: 'begerosse', name: 'Begerossé Union', short: 'Begerossé', gov: 'union', rulerTitle: 'Chairwoman', capital: 'begerosse', pop: 150, gdp: 9, tech: 0.83, stability: 76,
    traits: { militarism: 45, expansion: 30, isolation: 40, corruption: 30, ruthless: 35 }, mil: { troops: 600, armor: 50, air: 55, navy: 70 }, arsenal: { roses: 4, missiles: 40, bio: 1 },
    blocs: ['V5'], color: '#c76b2c', desc: 'A V5 founder. Its expedition met Pap, which keeps people as livestock.',
  },
  {
    key: 'padokea', name: 'Republic of Padokea', short: 'Padokea', gov: 'republic', rulerTitle: 'President', capital: 'dentora', pop: 90, gdp: 3, tech: 0.65, stability: 70,
    traits: { militarism: 30, expansion: 15, isolation: 40, corruption: 45, ruthless: 30 }, mil: { troops: 150, armor: 20, air: 15, navy: 10 }, arsenal: { roses: 0, missiles: 5, bio: 0 },
    blocs: [], color: '#8a7e6b', desc: 'Home of Kukuroo Mountain and Heavens Arena. The government leaves the Zoldyck family entirely alone.',
  },
  {
    key: 'egorteau', name: 'Republic of East Gorteau', short: 'East Gorteau', gov: 'dictatorship', rulerTitle: 'Supreme Leader', capital: 'peijin', pop: 50, gdp: 1, tech: 0.45, stability: 45,
    traits: { militarism: 85, expansion: 40, isolation: 85, corruption: 80, ruthless: 90 }, mil: { troops: 300, armor: 25, air: 15, navy: 10 }, arsenal: { roses: 0, missiles: 10, bio: 1 },
    blocs: ['Mitene'], color: '#a23b4a', desc: 'A closed dictatorship under Supreme Leader Ming Jol-ik, whose regime "selects" its own citizens.',
  },
  {
    key: 'wgorteau', name: 'Republic of West Gorteau', short: 'West Gorteau', gov: 'republic', rulerTitle: 'President', capital: 'wgorteau', pop: 30, gdp: 1.2, tech: 0.55, stability: 65,
    traits: { militarism: 40, expansion: 20, isolation: 30, corruption: 45, ruthless: 30 }, mil: { troops: 80, armor: 12, air: 8, navy: 8 }, arsenal: { roses: 0, missiles: 2, bio: 0 },
    blocs: ['Mitene'], color: '#c9634a', desc: 'The other half of Gorteau, wary of its neighbour.',
  },
  {
    key: 'ngl', name: 'NGL Autonomous Region', short: 'NGL', gov: 'autonomous', rulerTitle: 'Chief', capital: 'ngl', pop: 0.4, gdp: 0.4, tech: 0.05, stability: 70,
    traits: { militarism: 20, expansion: 5, isolation: 95, corruption: 70, ruthless: 50 }, mil: { troops: 4, armor: 0, air: 0, navy: 0 }, arsenal: { roses: 0, missiles: 0, bio: 0 },
    blocs: ['Mitene'], color: '#4e9c52', desc: 'Neo-Green Life. No machines, no metal at the border. Beneath it, a drug empire run by Gyro.',
  },
  {
    key: 'rokario', name: 'Republic of Rokario', short: 'Rokario', gov: 'republic', rulerTitle: 'President', capital: 'rokario', pop: 3, gdp: 0.1, tech: 0.4, stability: 70,
    traits: { militarism: 10, expansion: 5, isolation: 50, corruption: 40, ruthless: 20 }, mil: { troops: 8, armor: 1, air: 0, navy: 2 }, arsenal: { roses: 0, missiles: 0, bio: 0 },
    blocs: ['Mitene'], color: '#9aa3b8', desc: 'A small coastal republic in the Mitene Union.',
  },
  {
    key: 'jappon', name: 'Jappon', short: 'Jappon', gov: 'monarchy', rulerTitle: 'Emperor', capital: 'jappon', pop: 70, gdp: 4, tech: 0.75, stability: 85,
    traits: { militarism: 30, expansion: 10, isolation: 60, corruption: 20, ruthless: 25 }, mil: { troops: 120, armor: 20, air: 25, navy: 35 }, arsenal: { roses: 0, missiles: 10, bio: 0 },
    blocs: [], color: '#d96a8a', desc: 'An island nation of shrines and ninja clans. Hanzo is from here.',
  },
  {
    key: 'free', name: 'Free Islands', short: 'Free Islands', gov: 'autonomous', rulerTitle: 'Elder', capital: 'whale', pop: 0.1, gdp: 0.05, tech: 0.4, stability: 90,
    traits: { militarism: 0, expansion: 0, isolation: 50, corruption: 10, ruthless: 5 }, mil: { troops: 0, armor: 0, air: 0, navy: 1 }, arsenal: { roses: 0, missiles: 0, bio: 0 },
    blocs: [], color: '#d9c992', desc: 'Small islands in Lake Mobius that belong to no great power.',
  },
  {
    key: 'none', name: 'No nation', short: 'Stateless', gov: 'stateless', rulerTitle: '', capital: 'meteor', pop: 8, gdp: 0, tech: 0.2, stability: 50,
    traits: { militarism: 0, expansion: 0, isolation: 100, corruption: 0, ruthless: 50 }, mil: { troops: 0, armor: 0, air: 0, navy: 0 }, arsenal: { roses: 0, missiles: 0, bio: 0 },
    blocs: [], color: '#6b6b6b', desc: 'Places no nation claims: Meteor City, Greed Island, and what lies beyond the lake.',
  },
]

/** Starting opinions between nations, -100..100. Missing pairs start at 0. */
export const NATION_OPINION: [string, string, number][] = [
  ['kakin', 'saherta', -25], ['kakin', 'ochima', -15], ['kakin', 'begerosse', -10], ['kakin', 'mimbo', -5], ['kakin', 'kukanyu', -5],
  ['saherta', 'kukanyu', 40], ['saherta', 'mimbo', 35], ['saherta', 'ochima', 25], ['saherta', 'begerosse', 30],
  ['ochima', 'begerosse', 30], ['mimbo', 'kukanyu', 35], ['ochima', 'kukanyu', 25], ['mimbo', 'begerosse', 20], ['mimbo', 'ochima', 20],
  ['egorteau', 'wgorteau', -55], ['egorteau', 'saherta', -45], ['egorteau', 'ngl', 10], ['egorteau', 'rokario', -10],
  ['wgorteau', 'saherta', 20], ['jappon', 'kakin', -20], ['padokea', 'mimbo', 25],
]
