import type { beyondView, legendsView } from '../../sim/api/views'
import { COAST_LAND, MAP_W, MAP_H } from '../../data/geography'
import { PersonLink, Rich, useNav, useView } from '../ctx'
import { EventList } from './Chronicle'

/*
 * Lake Mobius as the manga draws it in chapter 342: a vast lake, the known
 * world a speck at its centre, and five marked landings on the far shore.
 * The lake's two ends are hidden by speech bubbles in the panel, so they are
 * closed here by following the curve of the visible shore. Coordinates are
 * the panel's own (695 x 386).
 */
const LAKE: [number, number][] = [
  [22, 120], [40, 92], [75, 62], [100, 48], [150, 38], [200, 32], [250, 45], [300, 62], [340, 78], [365, 86], [395, 77], [430, 58],
  [470, 45], [500, 40], [540, 22], [600, 14], [650, 22], [668, 60], [670, 140], [665, 200], [650, 250], [610, 265], [585, 272],
  [570, 300], [540, 318], [500, 335], [460, 346], [420, 336], [390, 313], [350, 304], [300, 303], [270, 310], [245, 325],
  [210, 340], [170, 340], [140, 330], [100, 310], [70, 292], [40, 265], [22, 210],
]
const LAKE_D = 'M' + LAKE.map(([x, y]) => `${x} ${y}`).join('L') + 'Z'
/** The five marked landings, and slots on the far shore for places nobody has named. */
const SLOT: Record<string, [number, number]> = { dc_ruins: [365, 70], dc_northeast: [425, 45], dc_southshore: [352, 326], dc_southeast: [530, 334], dc_swamp: [455, 358] }
const SPARE: [number, number][] = [[160, 20], [60, 345], [640, 360], [250, 368], [682, 300], [15, 40], [560, 6], [110, 372]]
const slot = (k: string | null | undefined): [number, number] => {
  if (!k) return HOME
  if (SLOT[k]) return SLOT[k]
  const m = /dc_u(\d+)/.exec(k)
  return m ? SPARE[+m[1] % SPARE.length] : HOME
}
const HOME: [number, number] = [312, 190]
/** The known world, drawn twice its size in the panel so it can be seen at all. */
const KW = 56 / MAP_W
const KNOWN_D = COAST_LAND.map((r) => {
  let d = ''
  for (let i = 0; i < r.length; i += 2) d += `${i ? 'L' : 'M'}${(HOME[0] - 28 + r[i] * KW).toFixed(1)} ${(HOME[1] - MAP_H * KW / 2 + r[i + 1] * KW).toFixed(1)}`
  return d + 'Z'
}).join('')

type BV = NonNullable<ReturnType<typeof beyondView>>

function LakeMap({ d }: { d: BV }) {
  const { open } = useNav()
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const live = d.runs.filter((r) => STAGES.slice(0, 4).includes(r.stage))
  return (
    <svg className="lake" viewBox="0 0 695 386" role="img" aria-label="Lake Mobius, with the known world at its centre and the Dark Continent around it">
      <rect x="0" y="0" width="695" height="386" fill="var(--beyond)" />
      <path d={LAKE_D} fill="var(--water)" stroke="var(--land-edge)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={HOME[0]} cy={HOME[1]} r="58" fill="none" stroke="var(--map-sea-text)" strokeDasharray="5 5" />
      <rect x={HOME[0] - 31} y={HOME[1] - 18} width="62" height="36" fill="var(--water-deep)" stroke="var(--map-sea-text)" strokeWidth="1" />
      <path d={KNOWN_D} fill="var(--land)" stroke="var(--land-edge)" strokeWidth="0.4" />
      <text x={HOME[0]} y={HOME[1] + 40} textAnchor="middle" className="lake-t sea">the known world</text>
      {d.calamities.map((c) => {
        const [x, y] = slot(c.regionKey)
        return (
          <g key={c.key} transform={`translate(${x} ${y})`}>
            <title>{c.known ? `${c.name}, ${c.title}. ${c.region}.` : 'Something nobody inside the lake has named.'}</title>
            <path d="M-8 -8L8 8M8 -8L-8 8" stroke={c.known ? 'var(--accent)' : '#8a8f94'} strokeWidth="4" strokeLinecap="round" />
            <text y={y < 30 ? 28 : -14} textAnchor="middle" className="lake-t">{c.known ? c.name : '?'}</text>
          </g>
        )
      })}
      {live.map((r, i) => {
        const goal = slot(r.goalKey ?? r.regionKey), here = slot(r.regionKey ?? r.goalKey)
        const at = r.stage === 'gathering' ? HOME : r.stage === 'crossing' ? lerp(HOME, goal, 0.55) : r.stage === 'exploring' ? lerp(here, HOME, 0.08) : lerp(here, HOME, 0.6)
        return (
          <g key={r.id} transform={`translate(${at[0] + (i % 3) * 6 - 6} ${at[1] + Math.floor(i / 3) * 6})`} style={{ cursor: 'pointer' }} onClick={() => open({ k: 'person', id: r.leader })}>
            <title>{`${r.name}: ${STAGE_LABEL[r.stage]}`}</title>
            <circle r="8" fill={r.legal ? 'var(--primary)' : 'var(--gold)'} stroke="var(--fg)" strokeWidth="1.2" />
          </g>
        )
      })}
    </svg>
  )
}

const STAGES = ['gathering', 'crossing', 'exploring', 'returning', 'home']
const STAGE_LABEL: Record<string, string> = { gathering: 'Gathering', crossing: 'Crossing', exploring: 'On the continent', returning: 'Coming home', home: 'Home', lost: 'Lost', turned_back: 'Turned back', caught: 'Caught' }

export function Beyond() {
  const d = useView<NonNullable<ReturnType<typeof beyondView>>>({ k: 'view', view: 'beyond' }, [], 2000)
  if (!d) return <div className="empty">Loading…</div>
  const active = d.runs.filter((r) => STAGES.slice(0, 4).includes(r.stage))
  const past = d.runs.filter((r) => !STAGES.slice(0, 4).includes(r.stage))
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>
        Everything outside Lake Mobius. The Inviolability Treaty has closed it for two hundred years. In this world, {d.attempts} illegal crossing{d.attempts === 1 ? ' has' : 's have'} been attempted and {d.returned} expedition{d.returned === 1 ? ' has' : 's have'} come home.
      </p>
      <LakeMap d={d} />
      <div className="sec">
        <h3>Expeditions under way</h3>
        {active.length ? active.map((r) => <Run key={r.id} r={r} names={d.names} />) : <div className="small muted">Nobody is out there right now.</div>}
      </div>
      <div className="sec">
        <h3>The calamities</h3>
        {d.calamities.map((c) => (
          <div key={c.key} className="card" style={{ borderLeft: `4px solid ${c.known ? 'var(--accent)' : 'var(--border)'}`, opacity: c.known ? 1 : 0.8 }}>
            <div className="ttl"><span>{c.name} <span className="small muted">{c.title}</span></span><span className="chip">{c.known ? `Threat ${c.threat}` : 'Unknown'}</span></div>
            <div className="small">{c.desc}</div>
            <div className="small muted">{c.region}{c.known ? <> · guards <b>{c.hope}</b>{c.brought ? `, brought home ${c.brought}×` : ''}</> : ''}{c.known ? ` · known to ${c.knownBy} people${c.public ? ', and now to everyone' : ''}` : ''}</div>
          </div>
        ))}
      </div>
      {d.hopes.length > 0 && <div className="sec"><h3>Hopes inside the lake</h3>{d.hopes.map((h) => (
        <div key={h.id} className="kv"><span className="chip gold">{h.name}</span><span className="small">{h.holder >= 0 ? <PersonLink id={h.holder} names={d.names} /> : h.place ? `in the vaults of ${h.place}` : 'lost'}{h.uses > 0 ? '' : ' (used up)'}</span></div>
      ))}</div>}
      {d.castaways.length > 0 && <div className="sec"><h3>Still out there, maybe</h3><div className="row">{d.castaways.map((id) => <span key={id} className="chip"><PersonLink id={id} names={d.names} /></span>)}</div></div>}
      <div className="sec"><h3>Past expeditions</h3>{past.length ? past.map((r) => <Run key={r.id} r={r} names={d.names} />) : <div className="small muted">None yet.</div>}</div>
    </>
  )
}

type R = NonNullable<ReturnType<typeof beyondView>>['runs'][number]
function Run({ r, names }: { r: R; names: NonNullable<ReturnType<typeof beyondView>>['names'] }) {
  const bad = r.stage === 'lost' || r.stage === 'caught' || r.stage === 'turned_back'
  const idx = STAGES.indexOf(r.stage)
  return (
    <div className="card">
      <div className="ttl"><span>{r.name}</span><span className={`chip${r.legal ? ' on' : ' red'}`}>{r.legal ? 'sanctioned' : 'illegal'}</span></div>
      <div className="steps">{STAGES.map((s, i) => <span key={s} className={s === r.stage ? 'now' : i < idx ? '' : ''} style={i < idx ? { color: 'var(--fg)' } : undefined}>{STAGE_LABEL[s]}</span>)}{bad && <span className="bad">{STAGE_LABEL[r.stage]}</span>}</div>
      <div className="small">Led by <PersonLink id={r.leader} names={names} />, with {r.members.length - 1} others. {r.dead ? `${r.dead} dead.` : ''} {r.stage === 'exploring' ? `Week ${r.weeks} beyond the lake, in ${r.region ?? 'the wild'}${r.goal && r.goal !== r.region ? `, heading for ${r.goal}` : ''}. Supplies ${r.supplies}%, morale ${r.morale}.` : ''}</div>
      {(r.met.length > 0 || r.found.length > 0) && <div className="row">{r.met.map((m) => <span key={m} className="chip red">met {m}</span>)}{r.found.map((f) => <span key={f} className="chip gold">{f}</span>)}</div>}
      {r.end && <div className="small muted"><Rich text={r.end} names={names} /> ({r.endDate})</div>}
    </div>
  )
}

export function Legends() {
  const { open } = useNav()
  const d = useView<ReturnType<typeof legendsView>>({ k: 'view', view: 'legends' }, [], 4000)
  if (!d) return <div className="empty">Loading…</div>
  const n = d.names
  return (
    <>
      <div className="sec"><h3>The most famous people alive</h3><div className="row">{d.famous.map((id) => <span key={id} className="chip"><PersonLink id={id} names={n} /></span>)}</div></div>
      <div className="sec"><h3>The strongest</h3>{d.strongest.map((s, i) => <div key={s.id} className="kv"><span>{i + 1}. <PersonLink id={s.id} names={n} /></span><span className="mono small">power {s.power} · Nen {s.lvl}</span></div>)}</div>
      {d.killers.length > 0 && <div className="sec"><h3>Most blood on their hands</h3>{d.killers.map((s) => <div key={s.id} className="kv"><span><PersonLink id={s.id} names={n} /></span><span className="mono small">{s.kills}</span></div>)}</div>}
      <div className="sec"><h3>Great events</h3><EventList events={d.great} names={n} /></div>
      {d.ended.length > 0 && <div className="sec"><h3>Stories that have ended</h3>{d.ended.map((s) => <div key={s.id} className="kv"><span><button className="lk" onClick={() => open({ k: 'story', id: s.id })}>{s.title}</button></span><span className="small muted">{s.from} – {s.to}</span></div>)}</div>}
      <div className="sec"><h3>The fallen</h3>{d.dead.map((x) => <div key={x.id} className="kv"><span><PersonLink id={x.id} names={n} /></span><span className="small muted" style={{ maxWidth: '62%' }}>{x.date}: {x.cause}</span></div>)}</div>
    </>
  )
}
