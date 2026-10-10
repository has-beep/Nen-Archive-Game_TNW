/**
 * Pixel people. Every person gets a look (skin, hair, outfit) generated from
 * their name, so the same person always looks the same, and the best-known
 * characters get a hand-picked look. From a look come three sprites: a body
 * for fights, a small token for the map, and a head-and-shoulders portrait.
 *
 * STUB: the API below is final; the drawings are placeholders until the
 * character pass replaces them.
 */
import { hash, NO_NEN, rand } from './palette'
import type { Sprite } from './sprite'

export interface Look {
  /** Stable key (from the name), used in sprite ids. */
  key: string
  skin: string
  hair: string
  /** Index into the hair styles the generator knows. */
  hairStyle: number
  /** Main clothing colour: the person's Nen colour when known. */
  outfit: string
  trim: string
  eyes: string
  mark?: 'star' | 'cross' | 'glasses' | 'beard' | 'scar' | 'ears'
  species?: 'human' | 'ant'
}

export type Pose = 'idle' | 'idle2' | 'attack' | 'hit' | 'down'

const SKINS = ['#f2c7a5', '#e0a982', '#c68a5e', '#9a6340', '#f5d6bf']
const HAIRS = ['#1a1c2c', '#4a3020', '#8a5a2a', '#e8c060', '#f4f4f4', '#b13e53', '#5d275d']

export function lookFor(name: string, outfit = NO_NEN, species: 'human' | 'ant' = 'human'): Look {
  const r = rand(hash(name))
  return {
    key: `${hash(name).toString(36)}`, species,
    skin: SKINS[Math.floor(r() * SKINS.length)], hair: HAIRS[Math.floor(r() * HAIRS.length)], hairStyle: Math.floor(r() * 6),
    outfit, trim: '#1a1c2c', eyes: '#1a1c2c',
  }
}

function block(id: string, w: number, h: number, look: Look): Sprite {
  const rows: string[] = []
  for (let y = 0; y < h; y++) {
    let row = ''
    for (let x = 0; x < w; x++) row += y < h * 0.25 ? 'h' : y < h * 0.45 ? 's' : 'o'
    rows.push(row)
  }
  return { id: `${id}:${look.key}:${look.outfit}`, w, h, rows, pal: { h: look.hair, s: look.skin, o: look.outfit } }
}

/** A full body, 16 x 24, facing right. */
export function bodySprite(look: Look, pose: Pose): Sprite { return block(`body-${pose}`, 16, 24, look) }
/** A small token for the map, 8 x 10; two frames for a little bounce. */
export function mapSprite(look: Look, frame: 0 | 1): Sprite { return block(`map-${frame}`, 8, 10, look) }
/** Head and shoulders, 16 x 16. */
export function portraitSprite(look: Look): Sprite { return block('portrait', 16, 16, look) }
