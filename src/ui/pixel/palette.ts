/**
 * The pixel look, shared by the map, the people and the fights.
 *
 * The base is Sweetie 16, a free 16-colour palette by GrafxKid, with a few
 * extra terrain shades. The day map is a bright 16-bit world map; the night
 * map (dark mode) is the same world under a darker sky. The six Nen colours
 * stay the Nen Archive's own, so a type always reads the same everywhere.
 */

export const SWEETIE = {
  ink: '#1a1c2c', plum: '#5d275d', red: '#b13e53', orange: '#ef7d57',
  yellow: '#ffcd75', lime: '#a7f070', green: '#38b764', teal: '#257179',
  navy: '#29366f', blue: '#3b5dc9', sky: '#41a6f6', cyan: '#73eff7',
  white: '#f4f4f4', silver: '#94b0c2', slate: '#566c86', charcoal: '#333c57',
} as const

/** Nen type colours, in hexagon order (Enhancer, Transmuter, Conjurer, Specialist, Manipulator, Emitter). */
export const NEN_PX = ['#22c55e', '#8b5cf6', '#ef4444', '#3b82f6', '#808080', '#f97316'] as const
export const NO_NEN = '#94a3b8'
export const ANT = '#b91c1c'

export interface MapPalette {
  /** Open water far from any coast, the lake proper, and the shallows. */
  deep: string; water: string; shallow: string; foam: string
  /** The coast's 1px outline, and the sand inside it. */
  coast: string; beach: string
  grass: string; grassLight: string; forest: string; forestDark: string
  hills: string; desert: string; desertDark: string
  rock: string; rockLight: string; snow: string
  /** Past the lake's rim: the Dark Continent. */
  beyond: string; beyondDither: string
  /** Map text: fill and its 1px outline; sea names use their own fill. */
  label: string; labelOutline: string; seaLabel: string
  /** Small marks: place dots, the gold of 'yours' and of a reached region. */
  mark: string; gold: string; danger: string
}

export const MAP_DAY: MapPalette = {
  deep: '#29366f', water: '#3b5dc9', shallow: '#41a6f6', foam: '#73eff7',
  coast: '#333c57', beach: '#ffcd75',
  grass: '#38b764', grassLight: '#a7f070', forest: '#257179', forestDark: '#1f5a3c',
  hills: '#8f9a4a', desert: '#ffcd75', desertDark: '#ef7d57',
  rock: '#566c86', rockLight: '#94b0c2', snow: '#f4f4f4',
  beyond: '#1a1c2c', beyondDither: '#5d275d',
  label: '#f4f4f4', labelOutline: '#1a1c2c', seaLabel: '#73eff7',
  mark: '#1a1c2c', gold: '#ffcd75', danger: '#b13e53',
}

export const MAP_NIGHT: MapPalette = {
  deep: '#0e1224', water: '#1a2245', shallow: '#29366f', foam: '#3b5dc9',
  coast: '#0b0d16', beach: '#8a7a52',
  grass: '#1f6b4a', grassLight: '#38b764', forest: '#174a46', forestDark: '#103532',
  hills: '#4f5a36', desert: '#8a7a52', desertDark: '#7a4a3a',
  rock: '#3d4660', rockLight: '#566c86', snow: '#94b0c2',
  beyond: '#07080f', beyondDither: '#2a1430',
  label: '#f4f4f4', labelOutline: '#0b0d16', seaLabel: '#73eff7',
  mark: '#f4f4f4', gold: '#ffcd75', danger: '#ef7d57',
}

/** Is the page in dark mode right now (explicit theme first, then the system)? */
export function darkMode(): boolean {
  const r = document.documentElement
  const t = r.getAttribute('data-theme')
  if (t) return t === 'dark'
  if (r.classList.contains('dark')) return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export const mapPalette = (dark = darkMode()): MapPalette => (dark ? MAP_NIGHT : MAP_DAY)

/** The pixel font. Pixelify Sans is loaded from Google Fonts in index.html. */
export const PIXEL_FONT = '"Pixelify Sans", "Silkscreen", ui-monospace, monospace'
export const pxFont = (size: number, weight = 500) => `${weight} ${Math.round(size)}px ${PIXEL_FONT}`

const AROUND: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]

/**
 * Text with a hard 1px outline, the way old RPG maps label things. Drawn at
 * whole pixels so it stays crisp. Set font, textAlign and textBaseline first.
 */
export function pxText(g: CanvasRenderingContext2D, t: string, x: number, y: number, fill: string, outline: string, w = 1) {
  x = Math.round(x); y = Math.round(y)
  g.fillStyle = outline
  for (const [dx, dy] of AROUND) g.fillText(t, x + dx * w, y + dy * w)
  g.fillStyle = fill
  g.fillText(t, x, y)
}

/** A stable 32-bit hash of a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

/** A small seeded random generator (mulberry32), for anything procedural. */
export function rand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Respect a reader who asked for less motion: pixel animations hold still. */
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
