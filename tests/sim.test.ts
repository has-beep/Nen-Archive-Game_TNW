import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/sim/worldgen/worldgen'
import { tick } from '../src/sim/tick'
import { reindex, alive } from '../src/sim/world'
import { Engine } from '../src/sim/api/engine'
import { hpMax } from '../src/sim/people/person'
import type { World } from '../src/sim/types'

function run(w: World, days: number) { for (let i = 0; i < days; i++) tick(w) }
function digest(w: World) {
  return [w.t, w.events.length, w.people.filter((p) => p.alive).length, w.events.slice(-20).map((e) => e.text).join('|'), Math.round(w.people.reduce((s, p) => s + p.nen.lvl, 0))].join(':')
}

describe('the world', () => {
  it('is deterministic: the same seed gives the same history', () => {
    const a = createWorld({ seed: 4242 }), b = createWorld({ seed: 4242 })
    run(a, 120); run(b, 120)
    expect(digest(a)).toBe(digest(b))
  })

  it('differs between seeds', () => {
    const a = createWorld({ seed: 1 }), b = createWorld({ seed: 2 })
    run(a, 60); run(b, 60)
    expect(digest(a)).not.toBe(digest(b))
  })

  it('survives a save and load mid-run and carries on identically', () => {
    const a = createWorld({ seed: 77 })
    run(a, 90)
    const b = JSON.parse(JSON.stringify(a)) as World
    reindex(b)
    run(a, 90); run(b, 90)
    expect(digest(b)).toBe(digest(a))
  })

  for (const seed of [3, 1999, 31337]) {
    it(`runs three years without breaking its own rules (seed ${seed})`, () => {
      const w = createWorld({ seed })
      run(w, 365 * 3)
      expect(w.t).toBe(365 * 3)
      // Canon structure holds.
      expect(w.events.some((e) => /Hunter Exam is over/.test(e.text))).toBe(true)
      for (const p of w.people) {
        expect(Number.isFinite(p.hp)).toBe(true)
        expect(Number.isFinite(p.nen.lvl)).toBe(true)
        expect(p.nen.lvl).toBeLessThanOrEqual(Math.max(p.nen.cap + 30, 140))
        if (p.alive) {
          expect(w.places[p.loc]).toBeDefined()
          expect(p.hp).toBeLessThanOrEqual(hpMax(p) + 1)
        } else expect(p.death).toBeDefined()
        // Bonds are always mutual.
        for (const id in p.rel) {
          const q = w.people[+id]
          if (!q) continue
          if (p.rel[id].bonds && !(q.rel[p.id])) throw new Error(`${p.name} has a bond with ${q.name} that is not returned`)
        }
      }
      // Nobody is in two places: everyone alive is either somewhere or on a trip.
      for (const p of alive(w)) if (p.trip) expect(p.trip.t1).toBeGreaterThanOrEqual(p.trip.t0)
      // A world neither dies out nor explodes.
      const living = alive(w).length
      expect(living).toBeGreaterThan(200)
      expect(living).toBeLessThan(900)
      // Organisations' leaders are alive members, or the seat is empty.
      for (const o of w.orgs) if (!o.dead && o.leader >= 0 && w.people[o.leader]?.alive) expect(w.people[o.leader].orgs.some((m) => m.org === o.id) || o.kind === 'bloc').toBe(true)
    })
  }
})

describe('the engine facade', () => {
  it('answers every view for a running world', () => {
    const e = new Engine()
    e.handle({ k: 'new', opts: { seed: 9 } })
    e.handle({ k: 'step', days: 30 })
    const f = e.handle({ k: 'frame' }) as { dots: unknown[]; follow: number }
    expect(f.dots.length).toBeGreaterThan(100)
    for (const view of ['world', 'beyond', 'legends', 'cast', 'player', 'places'] as const) expect(e.handle({ k: 'view', view })).toBeTruthy()
    expect(e.handle({ k: 'view', view: 'person', id: f.follow })).toBeTruthy()
    expect(e.handle({ k: 'view', view: 'place', id: 0 })).toBeTruthy()
    expect(e.handle({ k: 'view', view: 'nation', id: 1 })).toBeTruthy()
    expect(e.handle({ k: 'view', view: 'org', id: 0 })).toBeTruthy()
    const ch = e.handle({ k: 'view', view: 'chronicle', opts: { minImp: 1 } }) as { events: { id: number }[] }
    expect(ch.events.length).toBeGreaterThan(5)
    expect(e.handle({ k: 'view', view: 'event', id: ch.events[0].id })).toBeTruthy()
    const json = e.handle({ k: 'save' }) as string
    expect(JSON.parse(json).t).toBe(30)
  })

  it('lets the player create a character, guide one, and nudge fate', () => {
    const e = new Engine()
    e.handle({ k: 'new', opts: { seed: 10, tier: 'coffee' } })
    const r = e.handle({ k: 'create', spec: { name: 'Rin Aoba', sex: 'f', age: 15, type: 2, home: 1, role: 'drifter', dreams: [{ k: 'hunter' }], talent: 'gifted' } }) as { ok: boolean; id: number }
    expect(r.ok).toBe(true)
    const p = e.handle({ k: 'view', view: 'person', id: r.id }) as { owned: boolean; name: string }
    expect(p.owned).toBe(true)
    expect(p.name).toBe('Rin Aoba')
    e.handle({ k: 'step', days: 40 })
    const f = e.handle({ k: 'fate', fate: 'whisper', args: { target: r.id, act: 'train' } }) as { ok: boolean }
    expect(f.ok).toBe(true)
  })
})
