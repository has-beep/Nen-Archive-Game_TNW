/**
 * Combat balance harness. Runs canon match-ups many times through the real
 * fight engine and compares the win rate with what the story says should
 * happen. Nothing in the world is changed: runFight works on copies.
 *
 *   npm run balance
 *   npm run balance -- --n 400 --only netero
 */
import { createWorld } from '../src/sim/worldgen/worldgen'
import { buildCanon } from '../src/sim/worldgen/canon'
import { CANON_MORE } from '../src/data/canon-more'
import { CANON_MAIN } from '../src/data/canon-main'
import { personK, placeK } from '../src/sim/world'
import { runFight } from '../src/sim/combat/combat'
import { power, hpMax } from '../src/sim/people/person'
import type { Person, World } from '../src/sim/types'
import { TECHS, TECH_INFO } from '../src/sim/constants'
import { develop, readyForHatsu } from '../src/sim/nen/nen'

const args = process.argv.slice(2)
const arg = (k: string, d: string) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const N = +arg('n', '200')
const only = arg('only', '')

/** [side a, side b, expected win rate for a, why]. A range is [lo, hi]. */
const CASES: [string[], string[], [number, number], string][] = [
  [['netero'], ['meruem'], [0.0, 0.25], 'Netero gave everything and lost; only the Rose finished it'],
  [['netero'], ['neferpitou'], [0.5, 0.9], 'a Royal Guard is below Netero'],
  [['netero'], ['meleoron'], [0.97, 1], 'a squadron leader is nothing to Netero'],
  [['netero'], ['zeno_zoldyck'], [0.6, 1], 'Zeno says plainly that Netero is stronger'],
  [['neferpitou'], ['kite'], [0.85, 1], 'Pitou took Kite\'s arm and then his life'],
  [['meruem'], ['shaiapouf'], [0.97, 1], 'the King and his Guard'],
  [['menthuthuyoupi'], ['knuckle_bine'], [0.75, 1], 'Knuckle could only stall Youpi'],
  [['menthuthuyoupi'], ['killua_zoldyck@66'], [0.7, 1], 'Killua ran rings round Youpi, but could not beat him'],
  [['shaiapouf'], ['morel_mackernasey'], [0.45, 0.8], 'Pouf was winning against Morel before the King woke'],
  [['chrollo_lucilfer'], ['hisoka_morow'], [0.3, 0.75], 'Chrollo won the Heavens Arena fight, prepared'],
  [['kurapika@68'], ['uvogin'], [0.6, 1], 'Chain Jail was made for the Troupe'],
  [['silva_zoldyck'], ['chrollo_lucilfer'], [0.35, 0.75], 'Silva and Chrollo were even until Zeno joined'],
  [['silva_zoldyck', 'zeno_zoldyck'], ['chrollo_lucilfer'], [0.6, 1], 'together they had him'],
  [['feitan_portor'], ['zazan'], [0.6, 1], 'Rising Sun'],
  [['silva_zoldyck'], ['feitan_portor'], [0.65, 1], 'Silva is above any single Spider but the Head'],
  [['zeno_zoldyck'], ['feitan_portor'], [0.7, 1], 'Zeno is one of the strongest alive'],
  [['illumi_zoldyck'], ['feitan_portor'], [0.4, 0.9], 'Illumi and Feitan are close, Illumi likely ahead'],
  [['biscuit_krueger'], ['bara'], [0.85, 1], 'Bisky is a Double Star veteran'],
  [['hisoka_morow'], ['gon_freecss@30'], [0.95, 1], 'Gon is unripe fruit'],
  [['gon_freecss@62'], ['genthru'], [0.03, 0.5], 'Gon beat Genthru with a plan and a wrecked hand; head-on he rarely would'],
  [['gon_freecss@62', 'killua_zoldyck@66'], ['neferpitou'], [0.0, 0.3], 'they could not have beaten Pitou in a straight fight'],
  [['hisoka_morow'], ['illumi_zoldyck'], [0.25, 0.8], 'two monsters who never quite fought'],
  [['uvogin'], ['kastro'], [0.8, 1], 'a Troupe brawler and a Heavens Arena Floor Master'],
  [['knuckle_bine', 'shoot_mcmahon'], ['shaiapouf'], [0.0, 0.4], 'together they barely slowed him'],
  [['ging_freecss'], ['neferpitou'], [0.1, 0.6], 'one of the five best Nen users alive, against a Guard'],
  [['cheadle_yorkshire'], ['meleoron'], [0.4, 1], 'a Zodiac against an invisible squadron leader; canon never shows it'],
  [['mizaistom_nana'], ['welfin'], [0.4, 0.95], 'a Zodiac against a squadron leader'],
]

/** `key` or `key@lvl`: the character, grown to that Nen level with the
 *  techniques and destined abilities they would have by then. */
function ensure(w: World, spec: string): Person {
  const [key, at] = spec.split('@')
  let p = personK(w, key)
  if (!p) {
    const def = [...CANON_MAIN, ...CANON_MORE].find((d) => d.key === key)
    if (!def) throw new Error('no canon ' + key)
    p = buildCanon(w, { ...def, appears: undefined, home: 'ngl', loc: 'ngl' })
  }
  if (at) {
    const L = +at
    p.nen.awake = true
    p.nen.lvl = Math.max(p.nen.lvl, L)
    for (const t of TECHS) p.nen.tech[t] = Math.max(p.nen.tech[t] || 0, Math.min(100, Math.max(0, (L - TECH_INFO[t].req) * 1.8)))
    for (let i = 0; i < 8 && readyForHatsu(p); i++) develop(w, p, { quiet: true })
  }
  return p
}
function reset(ps: Person[]) {
  for (const p of ps) { p.hp = hpMax(p); p.nen.aura = 1; p.stam = 100; p.conds = []; p.wounds = []; p.nen.lifeSpent = 0; delete p.flags.judgment }
}

const w = createWorld({ seed: 1 })
const verbose = args.includes('--v')
const place = placeK(w, 'ngl').id
let bad = 0
console.log(`${'match-up'.padEnd(46)} ${'power'.padEnd(13)} win   want        `)
for (const [a, b, [lo, hi], why] of CASES) {
  if (only && !a.concat(b).some((k) => k.includes(only))) continue
  const A = a.map((k) => ensure(w, k)), B = b.map((k) => ensure(w, k))
  reset([...A, ...B])
  const pw = `${A.map((p) => Math.round(power(p))).join('+')} v ${B.map((p) => Math.round(power(p))).join('+')}`
  let wins = 0, len = 0
  for (let i = 0; i < N; i++) {
    reset([...A, ...B])
    const res = runFight(w, { a: A, b: B, intentA: 'kill', intentB: 'kill', place, record: false })
    if (res.winner === 0) wins++
    len += res.exchanges
  }
  const rate = wins / N
  const ok = rate >= lo && rate <= hi
  if (!ok) bad++
  console.log(`${(a.join('+') + ' v ' + b.join('+')).padEnd(46)} ${pw.padEnd(13)} ${(rate * 100).toFixed(0).padStart(3)}%  ${(lo * 100).toFixed(0).padStart(3)}-${(hi * 100).toFixed(0).padEnd(3)}%  ${ok ? '  ' : 'XX'} ${(len / N).toFixed(0).padStart(3)} ex  ${why}`)
}
console.log(`\n${bad} of ${CASES.length} outside the canon range.`)
