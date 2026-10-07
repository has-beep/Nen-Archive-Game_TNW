/**
 * Headless runner: build a world, run it, print the chronicle.
 *
 *   npm run sim -- --seed 4813 --days 400 --imp 3
 *   npm run sim -- --seed 7 --days 1200 --follow kurapika
 *
 * This is the first test of the whole design: if the history is not
 * interesting to read as plain text, no amount of art will save it.
 */
import { createWorld } from '../src/sim/worldgen/worldgen'
import { tick } from '../src/sim/tick'
import { plain } from '../src/sim/history'
import { dateStr } from '../src/sim/time'
import { alive, personK } from '../src/sim/world'

const args = process.argv.slice(2)
const arg = (k: string, d: string) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const seed = +arg('seed', '4813')
const days = +arg('days', '365')
const minImp = +arg('imp', '3')
const followKey = arg('follow', '')
const quiet = args.includes('--quiet')
const types = arg('type', '') ? new Set(arg('type', '').split(',')) : null

const t0 = Date.now()
const w = createWorld({ seed })
const tGen = Date.now() - t0
const follow = followKey ? personK(w, followKey) : undefined
const t1 = Date.now()
let printed = 0
for (let d = 0; d < days; d++) {
  const fresh = tick(w)
  if (quiet) continue
  for (const id of fresh) {
    const e = w.events.find((x) => x.id === id)
    if (!e) continue
    const mine = follow && e.who.includes(follow.id)
    if (types && !types.has(e.type)) continue
    if (e.imp >= minImp || (mine && e.imp >= 1)) {
      console.log(`${dateStr(w.epoch, e.t).padEnd(18)} [${e.imp}${mine ? '*' : ' '}] ${plain(w, e.text)}`)
      printed++
    }
  }
}
const tRun = Date.now() - t1
const living = alive(w)
const dead = w.people.filter((p) => !p.alive)
console.log('\n---')
console.log(`seed ${seed}: generated in ${tGen} ms, ${days} days in ${tRun} ms (${(tRun / days).toFixed(2)} ms/day)`)
console.log(`${living.length} alive, ${dead.length} dead, ${w.events.length} events, ${w.facts.length} facts, ${w.stories.filter((s) => s.status === 'active').length} active stories, ${printed} printed`)
const canonDead = dead.filter((p) => p.canon).map((p) => `${p.name} (${p.death?.cause})`)
console.log(`canon dead: ${canonDead.join('; ') || 'none'}`)
// How people died, grouped: "killed by X in Y" becomes "killed in Y".
const causes = new Map<string, number>()
for (const p of w.people) if (!p.alive && p.death) {
  const k = p.death.cause.replace(/killed by .*? in /, 'killed in ').replace(/^the final.*/, 'exam')
  causes.set(k, (causes.get(k) || 0) + 1)
}
console.log(`deaths by cause: ${[...causes].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(', ')}`)
const years = new Map<number, number>()
for (const p of w.people) if (!p.alive && p.death) { const y = Math.floor(p.death.t / 365); years.set(y, (years.get(y) || 0) + 1) }
console.log(`deaths by year: ${[...years].sort((a, b) => a[0] - b[0]).map(([y, n]) => `y${y}:${n}`).join(' ')}`)
const top = living.slice().sort((a, b) => b.fame - a.fame).slice(0, 10).map((p) => `${p.name} ${Math.round(p.fame)}`)
console.log(`most famous: ${top.join(', ')}`)
if (follow) {
  console.log(`\n${follow.name}: ${follow.alive ? 'alive' : 'dead'}, Nen level ${follow.nen.lvl.toFixed(1)}, ${follow.nen.awake ? 'awake' : 'not awake'}, licence ${follow.license ? 'yes' : 'no'}, at ${w.places[follow.loc].name}, doing ${follow.act.k}: ${follow.act.note}`)
  console.log('dreams:', follow.dreams.map((d) => `${d.k}${d.target != null ? ':' + (w.people[d.target]?.name || w.orgs[d.target]?.name || d.target) : ''} ${d.done ? 'DONE' : d.failed ? 'FAILED' : d.prog}`).join(', '))
  console.log('hatsu:', follow.nen.hatsu.map((h) => h.name).join(', '))
}
