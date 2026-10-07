/**
 * The map. Coastlines are traced from the official world map (the 2011
 * anime's, checked against the manga's map in chapter 38) by
 * scripts/trace-map.py into coast.ts. One tile is 200 km; the known world
 * is about 25,000 km across, inside Lake Mobius. Past the edges of this
 * map, across the lake, is the Dark Continent.
 *
 * Layout, west to east: the Padokea and Mimbo continent in the north-west,
 * the long Kukan'yu continent below it with Jappon offshore, the Yorbian
 * continent in the south-west (Saherta, Yorknew, and the Balsa Islands at
 * its southern tip), open water in the middle with Greed Island and
 * Begerossé, and the Azian continent filling the east: Kakin in the north,
 * a strait, then Ochima.
 */
import { COAST_LAND, COAST_WATER, TRACE_H, TRACE_W } from './coast'

export const KM_PER_TILE = 200
export const MAP_W = TRACE_W
export const MAP_H = TRACE_H

export { COAST_LAND, COAST_WATER }

function inRing(ring: number[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Is this point on land (and not in a lake or strait)? */
export function isLand(x: number, y: number): boolean {
  return COAST_LAND.some((r) => inRing(r, x, y)) && !COAST_WATER.some((r) => inRing(r, x, y))
}

/** [x, y, radius, height] */
export const MOUNTAINS: [number, number, number, number][] = [
  [28.5, 9.9, 3, 1.1], // Kukuroo Mountain and the Padokean highlands
  [36, 6, 4, 0.7], // north Mimbo
  [16.5, 15, 3.5, 0.8], // the spine of the Kukan'yu continent
  [70.4, 6.8, 1.6, 0.9], // the ring island is a caldera
  [101, 12, 5, 0.9], // northern Azia
  [93, 22, 4, 0.7], // Kakin's western hills
  [26, 51, 4, 0.6], // central Yorbia
  [107, 56, 4, 0.6], // Ochima uplands
  [76, 60, 2.5, 0.5], // Begerossé
]

export const REGION_LABELS: { n: string; x: number; y: number; sea?: boolean }[] = [
  { n: 'Republic of Padokea', x: 28, y: 4.6 }, { n: 'Mimbo Republic', x: 37, y: 14.8 },
  { n: "Kukan'yu Kingdom", x: 19.5, y: 30.6 }, { n: 'Jappon', x: 40, y: 25 },
  { n: 'United States of Saherta', x: 28, y: 44.6 }, { n: 'Yorbian Continent', x: 33, y: 55.5 },
  { n: 'Mitene Union', x: 47, y: 70.6 }, { n: 'Azian Continent', x: 99, y: 22 }, { n: 'Kakin Empire', x: 97, y: 33.6 },
  { n: 'Ochima Federation', x: 102, y: 46.8 }, { n: 'Begerossé Union', x: 76.3, y: 63 },
  { n: 'Lake Mobius', x: 62, y: 22, sea: true }, { n: 'Lake Mobius', x: 58, y: 68, sea: true },
  { n: 'to the Dark Continent', x: 64, y: -1.6, sea: true }, { n: 'to the Dark Continent', x: 64, y: 74.4, sea: true },
]
