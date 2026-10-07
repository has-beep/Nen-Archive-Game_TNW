/**
 * Pulls the wider canon cast from the Nen Archive's character files into a
 * compact list the world can place: key, name, Nen type, the arc they appear
 * in, and the names of their abilities. No descriptions or portraits are
 * copied; the game links to the Archive for those.
 *
 *   node scripts/import-archive.mjs [path to the website repo]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const site = process.argv[2] || '../v0-nen-archive-website'
const dir = join(site, 'HXH Characters')
const TYPES = { Enhancer: 0, Transmuter: 1, Conjurer: 2, Specialist: 3, Manipulator: 4, Emitter: 5 }
const KEEP = new Set(['HE', 'HA', 'YC', 'GI', 'HCE', 'SC'])
// Already written by hand, appears later, lives beyond the lake, or is not a separate person.
const SKIP = /^(don_freecss|nanika|kite_\(ant\)|kite_ant|unseen_character|.*cleaner|world_tree_guide)$/

const files = readdirSync(dir)
const arcOf = new Map()
for (const f of files) {
  const m = /^(.*)_([A-Z]{2,4})_Portrait_\d+\.png$/.exec(f)
  if (m) arcOf.set(m[1].toLowerCase(), m[2])
}
// Canon keys already in the game.
const canonSrc = ['src/data/canon-main.ts', 'src/data/canon-more.ts'].map((p) => readFileSync(p, 'utf8')).join('\n')
const have = new Set([...canonSrc.matchAll(/key: '([a-z_]+)'/g)].map((m) => m[1]))
const haveNames = new Set([...canonSrc.matchAll(/name: '([^']+)'/g)].map((m) => m[1].toLowerCase()))
const out = []
for (const f of files.filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const key = d.id.toLowerCase()
  const arc = arcOf.get(key) || arcOf.get(d.name.replace(/ /g, '_').toLowerCase())
  if (!arc || !KEEP.has(arc) || SKIP.test(key)) continue
  // Not separate people in this world: duplicates of hand-written entries, animals, a group, a cameo.
  if (/^(assassin [a-f]|casino king|fish|galactic matron|gold dust girl|harbormaster|hedgehog|mafia hacker|pirate .*|porcupine|princess corco|quizzing lady|rabid dog|sengi guild agent|ten dons|worm|franklin bordeau|eeta|isaac|mike|togashi|hunter association exorcist|batteras lover|bean)$/i.test(d.name)) continue
  // Labels rather than people: NPCs, numbered extras, relatives known only by relation.
  if (/\bnpc\b|\d|butler|grandmother|grandfather|mother|father|clerk|operator|auctioneer|announcer|\bguard\b|famil(y|ys)\b|bounty hunter|unnamed|unseen|soldier|member|elder|referee|receptionist|doctor$|nurse|driver|pilot|staff|attendant|chef|waiter|bartender|shopkeeper|merchant|villager|spectator|commentator|scientist|official|secretary$|manager|owner|boss$|^the |director|captain$|crew/i.test(d.name)) continue
  if (have.has(key) || haveNames.has(d.name.toLowerCase())) continue
  const type = TYPES[d.nen_type] ?? -1
  const abilities = (d.abilities || []).map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).slice(0, 4)
  out.push([key, d.name, type, arc, abilities])
}
const byArc = out.reduce((m, x) => ((m[x[3]] = (m[x[3]] || 0) + 1), m), {})
writeFileSync('src/data/archive-cast.ts', `/**
 * The wider canon cast, imported from the Nen Archive's character files by
 * scripts/import-archive.mjs. Generated; do not edit by hand.
 * [key, name, Nen type (-1 unconfirmed), arc, ability names]
 *
 * Arcs: HE Hunter Exam, HA Heavens Arena, YC Yorknew City, GI Greed Island,
 * HCE Hunter Chairman Election, SC Succession Contest.
 */
export type ArchiveEntry = [string, string, number, string, string[]]
export const ARCHIVE_CAST: ArchiveEntry[] = ${JSON.stringify(out, null, 0).replace(/\],\[/g, '],\n  [').replace(/^\[\[/, '[\n  [').replace(/\]\]$/, '],\n]')}
`)
console.log(out.length, 'characters', byArc, out.filter((x) => x[2] >= 0).length, 'with a confirmed Nen type')
