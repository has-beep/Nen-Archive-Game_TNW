/**
 * Sprites are tiny pictures written as text, one character per pixel, so the
 * game ships no image files:
 *
 *   { id: 'tower', w: 3, h: 4, pal: { k: '#1a1c2c', s: '#94b0c2' },
 *     rows: ['.k.', 'ksk', 'ksk', 'kkk'] }
 *
 * '.' and ' ' are transparent. Each sprite is drawn once per scale into a
 * small canvas and reused, so drawing hundreds of them per frame is cheap.
 */

export interface Sprite {
  /** Unique per picture and palette: it keys the cache. */
  id: string
  w: number
  h: number
  rows: string[]
  pal: Record<string, string>
}

const cache = new Map<string, HTMLCanvasElement>()
const MAX_CACHED = 600

/** The sprite drawn at an integer scale, cached. */
export function spriteCanvas(s: Sprite, scale: number): HTMLCanvasElement {
  scale = Math.max(1, Math.round(scale))
  const key = `${s.id}@${scale}`
  let c = cache.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = s.w * scale
  c.height = s.h * scale
  const g = c.getContext('2d')!
  for (let y = 0; y < s.h; y++) {
    const row = s.rows[y] || ''
    for (let x = 0; x < s.w; x++) {
      const ch = row[x]
      if (!ch || ch === '.' || ch === ' ') continue
      const col = s.pal[ch]
      if (!col) continue
      g.fillStyle = col
      g.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string)
  cache.set(key, c)
  return c
}

/**
 * Draw a sprite with its top-left at (x, y), or centred on (x, y) when
 * `centre` is set. Positions are rounded to whole pixels.
 */
export function drawSprite(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale: number, opts: { centre?: boolean; flipX?: boolean; alpha?: number } = {}) {
  const c = spriteCanvas(s, scale)
  let dx = opts.centre ? x - c.width / 2 : x
  let dy = opts.centre ? y - c.height / 2 : y
  dx = Math.round(dx); dy = Math.round(dy)
  const a = g.globalAlpha
  if (opts.alpha != null) g.globalAlpha = a * opts.alpha
  if (opts.flipX) {
    g.save(); g.translate(dx + c.width, dy); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore()
  } else g.drawImage(c, dx, dy)
  g.globalAlpha = a
}

/** The same picture with some palette entries swapped (e.g. a Nen-coloured outfit). */
export function recolour(s: Sprite, id: string, swap: Record<string, string>): Sprite {
  return { ...s, id, pal: { ...s.pal, ...swap } }
}

export function clearSprites() { cache.clear() }
