import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/sim/worldgen/worldgen'
import { buildCanon } from '../src/sim/worldgen/canon'
import { CANON_MORE } from '../src/data/canon-more'
import { CANON_MAIN } from '../src/data/canon-main'
import { personK, placeK } from '../src/sim/world'
import { runFight } from '../src/sim/combat/combat'
import { hpMax } from '../src/sim/people/person'
import type { Person, World } from '../src/sim/types'

const w: World = createWorld({ seed: 5 })
const place = placeK(w, 'ngl').id
function get(key: string): Person {
  return personK(w, key) || buildCanon(w, { ...[...CANON_MAIN, ...CANON_MORE].find((d) => d.key === key)!, appears: undefined, home: 'ngl', loc: 'ngl' })
}
function rate(a: string, b: string, n = 80): number {
  const A = get(a), B = get(b)
  let wins = 0
  for (let i = 0; i < n; i++) {
    for (const p of [A, B]) { p.hp = hpMax(p); p.nen.aura = 1; p.stam = 100; p.conds = []; p.wounds = [] }
    if (runFight(w, { a: [A], b: [B], intentA: 'kill', intentB: 'kill', place }).winner === 0) wins++
  }
  return wins / n
}

// The story's verdicts, with room for luck.
describe('canon match-ups', () => {
  it('the King is far beyond the Chairman', () => expect(rate('meruem', 'netero')).toBeGreaterThan(0.7))
  it('the Chairman is beyond a squadron leader', () => expect(rate('netero', 'meleoron')).toBeGreaterThan(0.9))
  it('a Royal Guard is beyond Kite', () => expect(rate('neferpitou', 'kite')).toBeGreaterThan(0.8))
  it('Uvogin is beyond a Floor Master', () => expect(rate('uvogin', 'kastro')).toBeGreaterThan(0.7))
  it('Bisky is beyond a Bomber', () => expect(rate('biscuit_krueger', 'bara')).toBeGreaterThan(0.8))
  it('fights last more than a couple of exchanges between equals', () => {
    const A = get('silva_zoldyck'), B = get('chrollo_lucilfer')
    let ex = 0
    for (let i = 0; i < 40; i++) { for (const p of [A, B]) { p.hp = hpMax(p); p.nen.aura = 1; p.conds = []; p.wounds = [] } ex += runFight(w, { a: [A], b: [B], intentA: 'kill', intentB: 'kill', place }).exchanges }
    expect(ex / 40).toBeGreaterThan(4)
  })
})
