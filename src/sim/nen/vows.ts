/**
 * Vows: restrictions sworn on one's own Nen for power.
 *
 * A vow aimed at a person or an organisation makes its maker stronger against
 * that target and only that target, priced in what is given up: focus (three
 * stars), years of life (four), life itself if the vow is broken or the fight
 * lost (five). The most extreme vow in the series, Gon's, gives up every bit
 * of future potential for one fight; it exists here too, and it is rare.
 */
import { P, log } from '../history'
import type { Id, Person, World } from '../types'
import { remember } from '../people/memory'
import { startStory } from '../story/storyteller'

export function vowMult(w: World, p: Person, target: Person): number {
  let m = 1
  for (const v of p.nen.vows) {
    if (v.person === target.id || (v.org != null && target.orgs.some((x) => x.org === v.org))) m *= v.mult
  }
  return m
}

export function swearVow(w: World, p: Person, t: { person?: Person; org?: { id: Id; name: string } }, stars: number, cause?: Id, reason?: string): Id {
  const mult = 1 + stars * 0.16 * w.laws.vowPower
  const penalty = stars >= 5 ? 'death' : stars >= 4 ? 'life' : 'none'
  const label = t.person ? t.person.name : `the ${t.org!.name}`
  const cost = stars >= 5 ? 'If it is broken, or the fight lost, it kills its maker.' : stars >= 4 ? 'It costs years of life.' : 'Every other kind of growth is given up to it.'
  const text = `${P(p)} swears a ${'★'.repeat(stars)} vow against ${t.person ? P(t.person) : label}${reason ? `, ${reason}` : ''}. ${cost}`
  const ev = log(w, { type: 'vow', imp: p.major || p.owned || t.person?.major ? 4 : 3, who: t.person ? [p.id, t.person.id] : [p.id], orgs: t.org ? [t.org.id] : undefined, at: p.loc, cause, text })
  p.nen.vows.push({ t: w.t, stars, text: `Against ${label}`, person: t.person?.id, org: t.org?.id, mult, penalty, ev })
  if (stars >= 3) p.nen.pot *= 0.75
  if (stars >= 4) p.span = Math.max(Math.floor((w.t - p.born) / 365) + 3, p.span - 8)
  remember(w, p, { k: 'vow', val: -10, str: 90, ev, text: `Swore a vow against ${label}.`, who: t.person?.id })
  startStory(w, 'vendetta', `${p.name}'s vow`, t.person ? [p.id, t.person.id] : [p.id], ev, `vow-${p.id}`)
  return ev
}

/**
 * Giving up everything for one fight. The next time they face the target,
 * their aura grows to what it would have been after a lifetime of training;
 * afterwards there is almost nothing left.
 */
export function swearAllIn(w: World, p: Person, target: Person, cause?: Id): Id {
  p.flags.allIn = target.id
  p.flags.allInFrom = w.t
  const ev = log(w, {
    type: 'vow', imp: 5, who: [p.id, target.id], at: p.loc, cause,
    text: `${P(p)} makes a vow with no limit on it: every year of growth still to come, spent now, to beat ${P(target)}. Whatever happens after does not matter to them.`,
  })
  remember(w, p, { k: 'vow', val: -30, str: 100, ev, text: `Gave up everything to beat ${target.name}.`, who: target.id })
  return ev
}
