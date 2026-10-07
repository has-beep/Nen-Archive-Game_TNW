/**
 * Seeded random numbers.
 *
 * The whole simulation draws from one stream whose state lives in the world
 * itself, so a saved world resumes exactly where it stopped and the same seed
 * always produces the same history. Nothing in src/sim may call Math.random.
 *
 * sfc32: small, fast, passes PractRand, and its state is four uint32s, which
 * serialise as a plain array.
 */
export type RngState = [number, number, number, number]

export class Rng {
  s: RngState

  /** The state array is used by reference, so a world's saved rng field is
   *  always current without copying back. */
  constructor(state: RngState) {
    this.s = state
  }

  static fromSeed(seed: number | string): Rng {
    const h = typeof seed === 'string' ? hashString(seed) : seed >>> 0
    const r = new Rng([0x9e3779b9, 0x243f6a88, 0xb7e15162, h >>> 0])
    for (let i = 0; i < 15; i++) r.next()
    return r
  }

  /** A child stream that does not disturb this one. Used by world generation
   *  so adding a new generator step never reshuffles everything after it. */
  fork(label: string): Rng {
    return Rng.fromSeed((hashString(label) ^ this.s[3] ^ (this.s[0] << 7)) >>> 0)
  }

  next(): number {
    const s = this.s
    const a = s[0] >>> 0, b = s[1] >>> 0, c = s[2] >>> 0, d = s[3] >>> 0
    const t = (((a + b) >>> 0) + d) >>> 0
    s[3] = (d + 1) >>> 0
    s[0] = (b ^ (b >>> 9)) >>> 0
    s[1] = (c + (c << 3)) >>> 0
    const c2 = ((c << 21) | (c >>> 11)) >>> 0
    s[2] = (c2 + t) >>> 0
    return t / 4294967296
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n)
  }

  /** Float in [a, b). */
  range(a: number, b: number): number {
    return a + this.next() * (b - a)
  }

  /** Integer in [a, b]. */
  irange(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** Picks by weight. Zero and negative weights never win. */
  weighted<T>(items: readonly T[], weight: (x: T) => number): T | null {
    let total = 0
    for (const it of items) total += Math.max(0, weight(it))
    if (total <= 0) return null
    let r = this.next() * total
    for (const it of items) {
      r -= Math.max(0, weight(it))
      if (r < 0) return it
    }
    return items[items.length - 1]
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t
    }
    return arr
  }

  /** Roughly normal, mean 0, sd 1 (sum of uniforms, cheap and bounded). */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508
  }

  /** A trait-like value around `mean`, clamped. */
  trait(mean: number, sd: number, lo = 0, hi = 100): number {
    const v = mean + this.gauss() * sd
    return v < lo ? lo : v > hi ? hi : Math.round(v)
  }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** Stable hash of two numbers, for per-pair or per-person variation that
 *  must not consume the main stream (e.g. "is X attracted to Y at all"). */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}
