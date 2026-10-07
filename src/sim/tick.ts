/**
 * One day of the world.
 *
 * The order matters and is fixed, so the same seed always gives the same
 * history: the calendar and the world's great forces first, then every
 * person in a shuffled (but seeded) order, then what happens between people
 * in each place, then fights, then the player's own clock.
 */
import type { Id, Person, World } from './types'
import { alive, rng, touch } from './world'
import { prune } from './history'
import { calendarDaily } from './society/calendar'
import { calamityDaily } from './society/calamity'
import { nationsWeekly } from './society/nations'
import { warsDaily } from './society/war'
import { orgsWeekly } from './society/orgs'
import { electionTick } from './society/election'
import { contractsTick } from './society/economy'
import { arenaDaily } from './society/arena'
import { greedDaily } from './society/greed'
import { arrive } from './society/travel'
import { bodyTick } from './people/health'
import { kill } from './events/death'
import { needsTick, think, doDay, placeDay, relationsWeekly } from './people/decide'
import { birthCheck, growUp } from './people/romance'
import { pruneFacts } from './people/knowledge'
import { encounters } from './events/encounters'
import { storiesWeekly } from './story/storyteller'
import { playerDaily } from './player/player'
import { isFree } from './people/person'

export function focusSet(w: World): Set<Id> {
  const s = new Set<Id>()
  const pl = w.player
  const add = (id: Id) => { const p = w.people[id]; if (p && p.alive) s.add(id) }
  add(pl.follow)
  pl.owned.forEach(add)
  pl.watch.forEach(add)
  const f = w.people[pl.follow]
  if (f && f.alive && !f.trip) for (const q of alive(w)) if (q.loc === f.loc && !q.trip) s.add(q.id)
  return s
}

export function tick(w: World): Id[] {
  w.fresh = []
  w.t++
  touch(w)
  const r = rng(w)
  const weekly = w.t % 7 === 0
  calendarDaily(w)
  calamityDaily(w)
  if (weekly) {
    nationsWeekly(w)
    orgsWeekly(w)
    storiesWeekly(w)
    contractsTick(w)
  }
  electionTick(w)
  warsDaily(w)
  const focus = focusSet(w)
  const order = r.shuffle(alive(w).slice())
  for (const p of order) dayFor(w, p, focus.has(p.id), weekly)
  touch(w)
  const placesWithPeople = new Set<Id>()
  for (const p of alive(w)) if (!p.trip) placesWithPeople.add(p.loc)
  for (const id of placesWithPeople) placeDay(w, id)
  arenaDaily(w)
  greedDaily(w)
  encounters(w)
  playerDaily(w)
  if (weekly) { prune(w); pruneFacts(w) }
  return w.fresh
}

function dayFor(w: World, p: Person, focus: boolean, weekly: boolean) {
  if (!p.alive) return
  arrive(w, p)
  const cause = bodyTick(w, p)
  if (cause) {
    const by = p.wounds.find((x) => x.by != null && x.by !== p.id && x.left > 0)?.by
    kill(w, p, { cause: cause === 'bleeding' ? 'bleeding to death' : cause, by: by != null ? w.people[by] : null, how: cause === 'bleeding' ? `{p${p.id}} bleeds to death${by != null ? `, never treated after the fight with {p${by}}` : ''}.` : undefined })
    return
  }
  // Needs drift slowly; outside the focus they are settled every other day.
  if (focus) needsTick(w, p)
  else if ((w.t + p.id) % 2 === 0) needsTick(w, p, 2)
  if (p.sex === 'f') birthCheck(w, p)
  if (weekly) { growUp(w, p); relationsWeekly(w, p) }
  if (p.trip) return
  if (isFree(p) && (w.t >= p.nextThink || (focus && w.t - (p.act.until - 2) >= 0 && p.act.k !== 'travel'))) think(w, p, focus)
  if (!p.trip) doDay(w, p, focus)
}
