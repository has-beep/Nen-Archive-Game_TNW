import type { beyondView, legendsView } from '../../sim/api/views'
import { PersonLink, Rich, useNav, useView } from '../ctx'
import { EventList } from './Chronicle'

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
