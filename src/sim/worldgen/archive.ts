/**
 * Placing the wider canon cast (imported from the Nen Archive) where their
 * arc puts them at the start of 1999, with roles, affiliations and Nen
 * that fit. These are lore-accurate names and types with generated lives:
 * the Exam candidates turn up to the Exam, the Greed Island players are in
 * the game, the Kakin guards serve their princes.
 */
import { ARCHIVE_CAST, type ArchiveEntry } from '../../data/archive-cast'
import type { CanonDef } from '../../data/canon-types'
import { hash2 } from '../rng'
import type { World } from '../types'
import { buildCanon, linkCanon } from './canon'
import { personK } from '../world'

export type ArchiveMode = 'none' | 'core' | 'full'

const ARC: Record<string, { home: string; nation: string; role: string; lvl: [number, number]; age: [number, number]; orgs?: CanonDef['orgs']; dreams?: CanonDef['dreams'] }> = {
  HE: { home: 'zaban', nation: 'kukanyu', role: 'drifter', lvl: [0, 20], age: [16, 40], dreams: [['hunter', null, 80]] },
  HA: { home: 'arena', nation: 'padokea', role: 'fighter', lvl: [30, 58], age: [20, 45], orgs: [['arena', 1]], dreams: [['strongest', null, 70]] },
  YC: { home: 'yorknew', nation: 'saherta', role: 'mafioso', lvl: [0, 50], age: [22, 55], orgs: [['mafia', 0]], dreams: [['wealth', null, 60]] },
  GI: { home: 'greed', nation: 'saherta', role: 'gamer', lvl: [40, 66], age: [20, 50], dreams: [['clear', null, 75]] },
  HCE: { home: 'swardani', nation: 'mimbo', role: 'contract', lvl: [48, 72], age: [25, 60], orgs: [['ha', 0]] },
  SC: { home: 'kakin', nation: 'kakin', role: 'guard', lvl: [20, 62], age: [22, 55], orgs: [['kakin_royal', 0, { title: 'Royal Guard' }]], dreams: [['serve', 'kakin_royal', 70]] },
}

function unit(seed: number, k: string, n: number) { return (hash2(seed, hashKey(k) + n) >>> 0) / 4294967296 }
function hashKey(k: string) { let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** The default cast: everyone from the arcs that start in 1998-1999, and
 *  the Succession Contest characters whose Nen or abilities are known. */
export function archiveEntries(mode: ArchiveMode): ArchiveEntry[] {
  if (mode === 'none') return []
  if (mode === 'full') return ARCHIVE_CAST
  return ARCHIVE_CAST.filter((e) => e[3] !== 'SC' || e[2] >= 0 || e[4].length > 0 || /Hui Guo Rou/.test(e[1]))
}

export function placeArchive(w: World, mode: ArchiveMode): number {
  let n = 0
  for (const [key, name, type, arc, abilities] of archiveEntries(mode)) {
    if (personK(w, key)) continue
    const a = ARC[arc]
    if (!a) continue
    const u = (i: number) => unit(w.seed, key, i)
    const examiner = /examiner/i.test(name)
    const royal = /Hui Guo Rou/.test(name)
    const knownNen = type >= 0 || abilities.length > 0
    const lvl = examiner ? 60 + u(1) * 15 : knownNen ? Math.max(a.lvl[0], 36) + u(1) * (a.lvl[1] + 8 - Math.max(a.lvl[0], 36)) : a.lvl[0] + u(1) * (a.lvl[1] - a.lvl[0])
    const age = a.age[0] + Math.floor(u(2) * (a.age[1] - a.age[0]))
    const body = (b: number) => Math.round(Math.max(20, Math.min(95, b + (u(10 + b) - 0.5) * 30)))
    const fighter = arc === 'HA' || arc === 'GI' || arc === 'SC' || arc === 'HCE'
    const def: CanonDef = {
      key, name, short: name.split(' ')[0], sex: u(3) < 0.62 ? 'm' : 'f', born: 1998 - age,
      home: examiner ? 'swardani' : a.home, nation: examiner ? 'mimbo' : a.nation, type, lvl: Math.round(lvl), awake: lvl > 18 || knownNen,
      pot: 0.4 + u(4) * 0.7, cap: Math.round(Math.min(92, lvl + 6 + u(5) * 22)),
      body: [body(fighter ? 60 : 48), body(fighter ? 60 : 48), body(fighter ? 58 : 46), body(55), body(fighter ? 58 : 48), body(52)],
      mind: [body(52), body(55), body(50), body(52), body(48)],
      p: {},
      role: examiner ? 'examiner' : royal ? 'royal' : a.role,
      orgs: examiner ? [['ha', 1]] : royal ? [['kakin_royal', 1]] : a.orgs,
      dreams: royal ? [['rule', 'kakin', 60]] : a.dreams,
      license: examiner || arc === 'HCE' ? { stars: u(6) < 0.2 ? 1 : 0, field: 'contract' } : undefined,
      bio: `${name}. Appears in the ${({ HE: 'Hunter Exam', HA: 'Heavens Arena', YC: 'Yorknew City', GI: 'Greed Island', HCE: 'Chairman Election', SC: 'Succession Contest' } as Record<string, string>)[arc]} arc. Their full entry is in the Nen Archive.`,
    }
    const p = buildCanon(w, def)
    linkCanon(w, p)
    if (abilities.length) p.flags.abilityNames = JSON.stringify(abilities)
    if (arc === 'GI') { p.flags.giAccess = 1; const d = p.dreams.find((x) => x.k === 'clear'); if (d) d.prog = 15 + Math.floor(u(7) * 55) }
    if (arc === 'HE' && !examiner) p.flags.examCandidate = 1999
    n++
  }
  return n
}
