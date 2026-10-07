/**
 * The storyteller. It never changes the world; it decides what is worth
 * showing. A deep simulation with a weak storyteller is boring to watch, so
 * this layer keeps track of storylines that are still running (a vendetta, a
 * war, a romance, an election), ranks events for the chronicle and the
 * headline, and remembers what each story was about when it ends.
 */
import type { HistEvent, Id, Storyline, World } from '../types'

export function startStory(w: World, k: string, title: string, who: Id[], ev: Id, key?: string): Storyline {
  if (key) {
    const ex = w.stories.find((s) => s.key === key && s.status === 'active')
    if (ex) { if (!ex.ev.includes(ev)) ex.ev.push(ev); ex.heat += 5; return ex }
  }
  const s: Storyline = { id: w.stories.length + 1, k, title, who: Array.from(new Set(who)), t0: w.t, status: 'active', ev: [ev], heat: 20, key }
  w.stories.push(s)
  const e = w.events[w.events.length - 1]
  if (e && e.id === ev) e.story = s.id
  return s
}

export function endStory(w: World, key: string, ev: Id, outcome: string) {
  const s = w.stories.find((x) => x.key === key && x.status === 'active')
  if (!s) return
  s.status = 'resolved'
  s.t1 = w.t
  s.outcome = outcome
  if (!s.ev.includes(ev)) s.ev.push(ev)
}

/** Attach an event to every active story whose people it involves. */
export function touchStories(w: World, ev: Id, who: Id[]) {
  if (!who.length) return
  for (const s of w.stories) {
    if (s.status !== 'active') continue
    if (who.some((id) => s.who.includes(id))) {
      if (!s.ev.includes(ev)) s.ev.push(ev)
      s.heat = Math.min(100, s.heat + 4)
      if (s.ev.length > 60) s.ev.splice(1, s.ev.length - 60)
    }
  }
}

/** Stories cool when nothing happens; very old quiet ones close. */
export function storiesWeekly(w: World) {
  for (const s of w.stories) {
    if (s.status !== 'active') continue
    s.heat = Math.max(0, s.heat - 1.5)
    const everyone = s.who.map((id) => w.people[id])
    if (everyone.length && everyone.every((p) => !p || !p.alive)) {
      s.status = 'resolved'
      s.t1 = w.t
      s.outcome = s.outcome || 'Everyone in it is dead.'
    } else if (s.heat <= 0 && w.t - s.t0 > 400) {
      s.status = 'resolved'
      s.t1 = w.t
      s.outcome = s.outcome || 'It faded without an ending.'
    }
  }
  if (w.stories.length > 400) w.stories = w.stories.filter((s) => s.status === 'active' || w.t - (s.t1 ?? w.t) < 1500 || s.heat > 30)
}

/**
 * How much the interface should care about an event, given who the player
 * follows and watches. The stored importance is the world's view; this is
 * the viewer's.
 */
export function salience(w: World, e: HistEvent): number {
  let s = e.imp
  const pl = w.player
  if (e.who.includes(pl.follow)) s += 2
  else if (e.who.some((id) => pl.watch.includes(id) || pl.owned.includes(id))) s += 1
  return s
}

/** The headline: the most salient fresh event, preferring the followed person. */
export function headline(w: World, fresh: HistEvent[]): HistEvent | null {
  let best: HistEvent | null = null, bs = -1
  for (const e of fresh) {
    if (e.type === 'move' || e.type === 'arrive') continue
    const s = salience(w, e)
    if (s > bs) { bs = s; best = e }
  }
  return best && bs >= 2 ? best : null
}
