/**
 * The map. One tile is 250 km. The series' world is Earth's continents
 * rearranged inside Lake Mobius, so each landmass is sized like the real one
 * it mirrors: South America upside down in the north (Kukan'yu), North
 * America on its side in the middle (the Yorbian continent, Saherta), Africa
 * in the west (Padokea, Mimbo), Australia between (Begerosse), Eurasia to the
 * east (Kakin and the Azian continent).
 *
 * Coastlines are drawn from these blobs with noise at render time, so the
 * shapes are lore-faithful in layout and generated in detail.
 */
export const KM_PER_TILE = 250
export const MAP_W = 120
export const MAP_H = 76

export interface LandMass {
  key: string
  name: string
  like?: string
  /** [x, y, radius] in tiles */
  b: [number, number, number][]
}

export const LAND: LandMass[] = [
  { key: 'north', name: 'Northern continent', like: 'South America, upside down', b: [[58, 4, 3.1], [58, 9, 4.5], [57.5, 15, 6.3], [57, 22, 8.2], [62, 24.5, 5.5], [51.5, 24, 5.1], [57, 28, 4.4], [50, 14, 3.6]] },
  { key: 'yorbian', name: 'Yorbian continent', like: 'North America, on its side', b: [[52, 44, 7.1], [60, 45, 7.8], [67.5, 41.5, 6.4], [63, 50.5, 5.1], [46, 50.5, 5.9], [70.5, 36, 4.6], [56, 39.5, 4.7]] },
  { key: 'balsa', name: 'Balsa Islands', b: [[47, 65, 6.5], [56, 67, 5], [65, 68, 5.5], [41, 66, 3.5], [72, 66, 3.2]] },
  { key: 'west', name: 'Western continent', like: 'Africa', b: [[14, 27, 8.3], [23, 27.5, 8.3], [30, 32, 6.4], [20, 35, 8.6], [25, 41, 6.9], [22.5, 47.5, 5.5], [9, 31, 4.8]] },
  { key: 'azian', name: 'Azian continent', like: 'Eurasia', b: [[104, 9, 7], [106, 17, 10], [102, 26, 11], [109, 30, 8], [104, 47, 8.5], [110, 51, 6], [99, 50, 5.5], [97, 36, 4.5]] },
  { key: 'begerosse', name: 'Begerossé', like: 'Australia', b: [[84, 59, 6.1], [89.5, 60.5, 4.8], [79.5, 60.5, 4.3]] },
  { key: 'ochima', name: 'Ochima', b: [[106, 66, 5.5], [112, 64, 4.5], [101, 68, 3.5]] },
  { key: 'jappon', name: 'Jappon', like: 'Japan', b: [[10, 11, 2.0], [11.3, 14.2, 1.4], [9.2, 7.8, 1.4]] },
  { key: 'whale', name: 'Whale Island', b: [[38, 20, 2.6]] },
  { key: 'greed', name: 'Greed Island', b: [[82, 43, 3.6]] },
  { key: 'dc', name: 'The Dark Continent shore', b: [[3, 70, 5], [9, 74, 4], [2, 62, 3]] },
]

/** [x, y, radius, height] */
export const MOUNTAINS: [number, number, number, number][] = [
  [15, 26, 7, 1.2], [22, 40, 4, 0.7], [57, 12, 4, 0.8], [62, 41, 3, 0.55], [107, 14, 5, 0.9], [100, 34, 3.5, 0.7], [10, 10, 2.5, 0.8], [86, 59, 2.5, 0.5],
]

export const REGION_LABELS: { n: string; x: number; y: number; sea?: boolean }[] = [
  { n: "Kukan'yu Kingdom", x: 57, y: 13 }, { n: 'Republic of Padokea', x: 15, y: 36 }, { n: 'Mimbo Republic', x: 26, y: 43 },
  { n: 'United States of Saherta', x: 63, y: 53 }, { n: 'Mitene Union', x: 56, y: 73 }, { n: 'Kakin Empire', x: 106, y: 19 },
  { n: 'Azian Continent', x: 105, y: 45 }, { n: 'Begerossé Union', x: 85, y: 63 }, { n: 'Ochima Federation', x: 107, y: 70 },
  { n: 'Lake Mobius', x: 86, y: 24, sea: true }, { n: 'Lake Mobius', x: 33, y: 62, sea: true }, { n: 'Dark Continent', x: 8, y: 68 },
]
