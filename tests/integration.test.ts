import { describe, expect, it } from 'vitest'
import { fromAbility, fromOriginal, type ArchiveAbility, type ArchiveOC } from '../src/integration/archive-adapter'
import { Engine } from '../src/sim/api/engine'

const ability: ArchiveAbility = {
  title: 'Lantern Chain', mainDescription: 'A conjured chain that binds a target and drains their aura into a lantern.',
  allocations: [{ type: 'Conjurer', role: 'main', points: 70 }, { type: 'Manipulator', role: 'secondary', points: 30 }],
  vows: { activationDifficulty: 2, physicalMentalCost: 0, targetingSpecificity: 4, consequencePenalty: 5, frequencyCooldown: 0 },
  vowText: { consequencePenalty: 'If she uses it on someone innocent, it kills her.' },
  grade: 'A',
}
const oc: ArchiveOC = {
  name: 'Mirei Sato', gender: 'female', age: 17, occupation: 'Student', affiliationPresets: ['whale-island'],
  personality: 'Curious and kind, but stubborn and a little reckless.', backstory: 'She wants to become a Hunter to find her missing brother.',
  realized: { nenType: 'Conjurer', hunterLicense: false },
}

describe('Nen Archive adapter', () => {
  it('turns a Ledger ability into a Hatsu with its vows as conditions', () => {
    const h = fromAbility(ability)
    expect(h.name).toBe('Lantern Chain')
    expect(h.cats[0][0]).toBe(2)
    expect(h.effects.map((e) => e.k)).toEqual(expect.arrayContaining(['bind', 'drain']))
    expect(h.conds!.find((c) => c.k === 'death_penalty')?.text).toMatch(/innocent/)
    expect(h.conds!.length).toBe(3)
  })
  it('turns an Original Character into a run character with the ability waiting', () => {
    const spec = fromOriginal(oc, (k) => (k === 'whale' ? 0 : 5), ability)
    expect(spec.sex).toBe('f')
    expect(spec.type).toBe(2)
    expect(spec.home).toBe(0)
    expect(spec.role).toBe('student')
    expect(spec.dreams?.some((d) => d.k === 'hunter')).toBe(true)
    expect(spec.facets?.curiosity).toBeGreaterThan(0)
    expect(spec.hatsu?.name).toBe('Lantern Chain')
  })
  it('brings the character into a running world through the engine', () => {
    const e = new Engine()
    e.handle({ k: 'new', opts: { seed: 12 } })
    const r = e.handle({ k: 'importOC', oc, ability }) as { ok: boolean; id: number }
    expect(r.ok).toBe(true)
    const p = e.handle({ k: 'view', view: 'person', id: r.id }) as { name: string; owned: boolean; nen: { awake: boolean } }
    expect(p.name).toBe('Mirei Sato')
    expect(p.owned).toBe(true)
    expect(p.nen.awake).toBe(false)
  })
})
