/**
 * Follow one person through a run and print everything that happened to them.
 *   npx tsx scripts/debug-person.ts <seed> <days> <key or name> [--acts]
 */
import { createWorld } from '../src/sim/worldgen/worldgen'
import { tick } from '../src/sim/tick'
import { plain, eventById } from '../src/sim/history'
import { dateStr } from '../src/sim/time'
import { personK } from '../src/sim/world'

const [seed, days, key] = [+process.argv[2], +process.argv[3], process.argv[4]]
const w = createWorld({ seed })
const p = personK(w, key) || w.people.find((x) => x.name.includes(key))!
for (let d = 0; d < days; d++) {
  const before = p.act.note
  tick(w)
  if (p.act.note !== before && process.argv.includes('--acts')) console.log(`${dateStr(w.epoch, w.t)} act ${p.act.k}: ${p.act.note} @ ${w.places[p.loc].name}${p.trip ? ' (travelling)' : ''}`)
}
for (const id of p.life) {
  const e = eventById(w, id)
  if (e) console.log(`${dateStr(w.epoch, e.t)} [${e.imp}] ${plain(w, e.text)}`)
}
console.log(JSON.stringify({ dreams: p.dreams, plan: p.plan, flags: p.flags, lvl: p.nen.lvl, loc: w.places[p.loc].name }, null, 1).slice(0, 2000))
