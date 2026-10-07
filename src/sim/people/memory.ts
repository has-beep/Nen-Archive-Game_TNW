/**
 * Memories and mood. A memory is something that happened to a person and how
 * it felt. Strong ones fade slowly and keep pulling on mood; the worst become
 * the reasons people do drastic things (a vow, a breakdown, leaving).
 */
import type { Id, Memory, Person, World } from '../types'

export function remember(w: World, p: Person, m: Omit<Memory, 't'> & { t?: number }) {
  const mem: Memory = { t: m.t ?? w.t, ev: m.ev, k: m.k, who: m.who, val: m.val, str: m.str, text: m.text }
  p.memories.push(mem)
  // Mood moves at once by how much it mattered.
  p.mood.happy = clamp(p.mood.happy + mem.val * mem.str / 250, 0, 100)
  if (mem.val < 0) p.mood.stress = clamp(p.mood.stress - mem.val * mem.str / 300, 0, 100)
  if (p.memories.length > 60) {
    // Forget the faintest memory, not the oldest.
    let wi = 0
    for (let i = 1; i < p.memories.length; i++) if (p.memories[i].str < p.memories[wi].str) wi = i
    p.memories.splice(wi, 1)
  }
}

/** Daily: memories fade, mood drifts toward what the person's life is like. */
export function moodTick(w: World, p: Person, days = 1) {
  let pull = 0
  for (const m of p.memories) {
    // Grief and trauma fade far slower than ordinary things.
    const rate = m.str > 70 ? 0.04 : m.str > 40 ? 0.12 : 0.3
    m.str = Math.max(0, m.str - rate * days)
    pull += m.val * m.str / 100
  }
  p.memories = p.memories.filter((m) => m.str > 1)
  const target = clamp(55 + pull / 6 - p.mood.stress / 3 - p.mood.grief / 3, 0, 100)
  p.mood.happy += (target - p.mood.happy) * Math.min(1, 0.08 * days)
  p.mood.fear = Math.max(0, p.mood.fear - 3 * days)
  p.mood.anger = Math.max(0, p.mood.anger - 2.5 * days * (1 - p.facets.vengefulness / 200))
  p.mood.grief = Math.max(0, p.mood.grief - 0.35 * days * (0.5 + p.facets.composure / 100))
}

export function strongestMemoryOf(p: Person, who: Id): Memory | undefined {
  let best: Memory | undefined
  for (const m of p.memories) if (m.who === who && (!best || Math.abs(m.val) * m.str > Math.abs(best.val) * best.str)) best = m
  return best
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
