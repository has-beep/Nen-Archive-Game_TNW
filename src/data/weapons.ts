/**
 * Ordinary weapons a person can carry. Firearms do fixed damage that does not
 * grow with the wielder's strength, which is why a strong Nen user can walk
 * through gunfire: their guard grows with their aura and the bullet does not
 * (Uvogin against the Mafia). Blades and thrown weapons scale with strength,
 * and with Shu they carry the wielder's aura.
 *
 * National arsenals (troops, armour, the Poor Man's Rose) are abstract and
 * live on the Nation.
 */
export interface WeaponDef {
  key: string
  name: string
  skill: 'unarmed' | 'blades' | 'firearms' | 'thrown'
  /** Multiplier on strength-based damage. */
  mult: number
  /** Fixed damage that ignores strength (firearms, explosives). */
  fixed: number
  range: 'melee' | 'mid' | 'far'
  acc: number
  /** Can Shu carry aura into it. */
  shu: boolean
  area?: boolean
  poison?: boolean
  verb: string
}

export const WEAPONS: Record<string, WeaponDef> = {
  fists: { key: 'fists', name: 'bare hands', skill: 'unarmed', mult: 1, fixed: 0, range: 'melee', acc: 0, shu: false, verb: 'hits' },
  claws: { key: 'claws', name: 'claws', skill: 'unarmed', mult: 1.35, fixed: 0, range: 'melee', acc: 0.03, shu: false, verb: 'rakes' },
  knife: { key: 'knife', name: 'knife', skill: 'blades', mult: 1.2, fixed: 2, range: 'melee', acc: 0.02, shu: true, verb: 'cuts' },
  katana: { key: 'katana', name: 'katana', skill: 'blades', mult: 1.55, fixed: 3, range: 'melee', acc: 0.02, shu: true, verb: 'slashes' },
  umbrella: { key: 'umbrella', name: 'umbrella sword', skill: 'blades', mult: 1.4, fixed: 2, range: 'melee', acc: 0.03, shu: true, verb: 'skewers' },
  staff: { key: 'staff', name: 'staff', skill: 'blades', mult: 1.2, fixed: 0, range: 'melee', acc: 0.03, shu: true, verb: 'strikes' },
  cards: { key: 'cards', name: 'playing cards', skill: 'thrown', mult: 0.85, fixed: 0, range: 'mid', acc: 0.05, shu: true, verb: 'slices with a card' },
  yoyo: { key: 'yoyo', name: 'steel yo-yos', skill: 'thrown', mult: 1.25, fixed: 2, range: 'mid', acc: 0.02, shu: true, verb: 'whips a yo-yo into' },
  needles: { key: 'needles', name: 'needles', skill: 'thrown', mult: 0.55, fixed: 1, range: 'mid', acc: 0.06, shu: true, verb: 'plants a needle in' },
  fishing_rod: { key: 'fishing_rod', name: 'fishing rod', skill: 'thrown', mult: 1.05, fixed: 1, range: 'mid', acc: 0.04, shu: true, verb: 'lashes' },
  briefcase: { key: 'briefcase', name: 'briefcase', skill: 'blades', mult: 1.1, fixed: 1, range: 'melee', acc: 0, shu: true, verb: 'swings at' },
  pistol: { key: 'pistol', name: 'pistol', skill: 'firearms', mult: 0, fixed: 22, range: 'mid', acc: 0.04, shu: false, verb: 'shoots' },
  smg: { key: 'smg', name: 'submachine gun', skill: 'firearms', mult: 0, fixed: 30, range: 'mid', acc: 0.08, shu: false, verb: 'sprays' },
  rifle: { key: 'rifle', name: 'rifle', skill: 'firearms', mult: 0, fixed: 38, range: 'far', acc: 0.05, shu: false, verb: 'shoots' },
  sniper: { key: 'sniper', name: 'sniper rifle', skill: 'firearms', mult: 0, fixed: 70, range: 'far', acc: 0.02, shu: false, verb: 'snipes' },
  rpg: { key: 'rpg', name: 'rocket launcher', skill: 'firearms', mult: 0, fixed: 110, range: 'far', acc: -0.05, shu: false, area: true, verb: 'fires a rocket at' },
  grenade: { key: 'grenade', name: 'grenades', skill: 'thrown', mult: 0, fixed: 75, range: 'mid', acc: -0.03, shu: false, area: true, verb: 'throws a grenade at' },
  poison_darts: { key: 'poison_darts', name: 'poison darts', skill: 'thrown', mult: 0.4, fixed: 4, range: 'mid', acc: 0.04, shu: true, poison: true, verb: 'darts' },
}

/** What generated people carry, by role. */
export const ROLE_WEAPONS: Record<string, string[]> = {
  mafioso: ['pistol', 'pistol', 'smg', 'knife'],
  guard: ['pistol', 'smg', 'fists', 'knife'],
  don: ['pistol'],
  soldier: ['rifle', 'rifle', 'smg', 'rpg'],
  officer: ['pistol', 'rifle'],
  thief: ['knife', 'fists', 'katana', 'fists'],
  assassin: ['fists', 'needles', 'knife', 'poison_darts'],
  butler: ['fists', 'knife', 'staff'],
  ninja: ['knife', 'poison_darts', 'fists'],
  blacklist: ['fists', 'pistol', 'knife'],
  mercenary: ['rifle', 'smg', 'knife'],
  criminal: ['pistol', 'knife'],
  poacher: ['rifle', 'knife'],
  fighter: ['fists', 'fists', 'staff'],
  ant: ['claws'],
}
