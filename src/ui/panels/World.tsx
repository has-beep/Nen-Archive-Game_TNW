import type { nationView, orgView, placeView, storyView, worldView } from '../../sim/api/views'
import { Bar, PersonLink, Rich, useNav, useView } from '../ctx'
import { EventList } from './Chronicle'

export function WorldPanel() {
  const { open } = useNav()
  const d = useView<ReturnType<typeof worldView>>({ k: 'view', view: 'world' }, [], 2000)
  if (!d) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="sec">
        <h3>What is happening</h3>
        {d.stories.length ? d.stories.map((s) => (
          <div key={s.id} className="kv"><span><button className="lk" onClick={() => open({ k: 'story', id: s.id })}>{s.title}</button></span><span className="small muted">since {s.since} · {s.n} events</span></div>
        )) : <div className="small muted">A quiet moment, for now.</div>}
      </div>
      {d.wars.length > 0 && <div className="sec"><h3>Wars</h3>{d.wars.map((w) => (
        <div key={w.id} className="card">
          <div className="ttl"><span>{w.name}</span><span className="small muted">since {w.start}</span></div>
          <div className="small">{w.goal}</div>
          <Bar label="Who leads" v={w.score} div max={100} />
          <div className="small muted">Soldiers dead: {Math.round(w.dead[0])} attacking, {Math.round(w.dead[1])} defending.</div>
        </div>
      ))}</div>}
      {d.disasters.length > 0 && <div className="sec"><h3>Places in danger</h3>{d.disasters.map((p) => (
        <div key={p.id} className="kv"><span><button className="lk" onClick={() => open({ k: 'place', id: p.id })}>{p.name}</button></span><span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>{p.hazards.map((h) => <span key={h.k} className="chip" style={{ borderColor: h.color, color: h.color }}>{h.label} {h.sev}%</span>)}</span></div>
      ))}</div>}
      <div className="sec">
        <h3>Nations</h3>
        {d.nations.map((n) => (
          <div key={n.id} className="kv">
            <span><button className="lk" style={{ borderBottomColor: n.color }} onClick={() => open({ k: 'nation', id: n.id })}>{n.name}</button>{n.atWar && <span className="chip red" style={{ marginLeft: 6 }}>at war</span>}{n.blocs.map((b) => <span key={b} className="chip" style={{ marginLeft: 4 }}>{b}</span>)}</span>
            <span className="mono small">{n.stability}%</span>
          </div>
        ))}
      </div>
      <div className="sec">
        <h3>Organisations</h3>
        {d.orgs.map((o) => (
          <div key={o.id} className="kv"><span><button className="lk" style={{ borderBottomColor: o.color }} onClick={() => open({ k: 'org', id: o.id })}>{o.name}</button></span><span className="small muted">{o.count} {o.leader >= 0 ? <>· <PersonLink id={o.leader} names={d.names} /></> : null}</span></div>
        ))}
      </div>
    </>
  )
}

export function PlaceDetail({ id }: { id: number }) {
  const d = useView<NonNullable<ReturnType<typeof placeView>>>({ k: 'view', view: 'place', id }, [id], 1500)
  if (!d) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="sec">
        <h2 className="name">{d.name}</h2>
        <div className="sub">{d.kind} · {d.region}{d.nation ? ` · ${d.nation}` : ''}</div>
        {d.desc && <p className="small" style={{ margin: 0 }}>{d.desc}</p>}
      </div>
      <div className="grid2">
        <div className="kv"><span>People</span><span className="mono">{d.pop.toLocaleString()},000{d.base && d.base.pop > d.pop ? ` (was ${d.base.pop.toLocaleString()},000)` : ''}</span></div>
        <div className="kv"><span>Wealth</span><span className="mono">{d.wealth}</span></div>
        <div className="kv"><span>Danger</span><span className="mono">{d.danger}</span></div>
        <div className="kv"><span>Unrest</span><span className="mono">{d.unrest}</span></div>
      </div>
      {d.hazards.length > 0 && <div className="sec"><h3>Hazards</h3>{d.hazards.map((h) => (
        <div key={h.k} className="card" style={{ borderLeft: `4px solid ${h.color}` }}>
          <div className="ttl"><span style={{ textTransform: 'capitalize' }}>{h.name}</span><span className="mono small">{h.sev}%</span></div>
          <div className="small muted">Since {h.since}. People who come help by {h.help}.</div>
        </div>
      ))}</div>}
      <div className="sec"><h3>Here now ({d.count})</h3>
        {d.people.length ? d.people.map((p) => <div key={p.id} className="kv"><span><PersonLink id={p.id} names={d.names} /></span><span className="small muted" style={{ maxWidth: '60%' }}>{p.doing}</span></div>) : <div className="small muted">Nobody of note.</div>}
      </div>
      <div className="sec"><h3>What happened here</h3><EventList events={d.events} names={d.names} /></div>
    </>
  )
}

export function NationDetail({ id }: { id: number }) {
  const { open } = useNav()
  const d = useView<NonNullable<ReturnType<typeof nationView>>>({ k: 'view', view: 'nation', id }, [id], 2000)
  if (!d) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="sec">
        <div className="stripe" style={{ background: d.color }} />
        <h2 className="name">{d.name}</h2>
        <div className="sub">{d.gov} · capital {d.capital}{d.ruler != null ? <> · {d.rulerTitle} <PersonLink id={d.ruler} names={d.names} /></> : null}</div>
        {d.desc && <p className="small" style={{ margin: 0 }}>{d.desc}</p>}
        <div className="row">{d.blocs.map((b) => <span key={b} className="chip on">{b}</span>)}{d.hopes.map((h) => <span key={h} className="chip gold">{h}</span>)}</div>
      </div>
      <div className="grid2">
        <div className="kv"><span>Population</span><span className="mono">{d.pop}M</span></div>
        <div className="kv"><span>Economy</span><span className="mono">{d.gdp}</span></div>
        <div className="kv"><span>Treasury</span><span className="mono">{d.treasury.toLocaleString()}B J</span></div>
        <div className="kv"><span>Stability</span><span className="mono">{d.stability}%</span></div>
        <div className="kv"><span>Troops</span><span className="mono">{d.mil.troops.toLocaleString()}k</span></div>
        <div className="kv"><span>Air / navy</span><span className="mono">{d.mil.air} / {d.mil.navy}</span></div>
        <div className="kv"><span>Missiles</span><span className="mono">{d.arsenal.missiles}</span></div>
        <div className="kv"><span>Poor Man's Roses</span><span className="mono" style={{ color: d.arsenal.roses ? 'var(--accent)' : undefined }}>{d.arsenal.roses}</span></div>
      </div>
      {d.wars.length > 0 && <div className="sec"><h3>Wars</h3>{d.wars.map((w) => <div key={w.id} className="kv"><span>{w.name}</span><span className="small muted">{w.start}{w.end ? `–${w.end}` : ', ongoing'}</span></div>)}</div>}
      <div className="sec"><h3>How it sees the others</h3>{d.rel.map((r) => <div key={r.id} className="barline" style={{ gridTemplateColumns: '120px minmax(0,1fr) 34px' }}><button className="lk lab" onClick={() => open({ k: 'nation', id: r.id })}>{r.name}</button><div className="track div"><i style={{ left: r.op >= 0 ? '50%' : `${50 - Math.abs(r.op) / 2}%`, width: `${Math.abs(r.op) / 2}%`, background: r.war ? 'var(--accent)' : r.op >= 0 ? 'var(--primary)' : 'var(--warn)' }} /></div><span className="num">{r.op}</span></div>)}</div>
      <div className="sec"><h3>Recent history</h3><EventList events={d.events} names={d.names} /></div>
    </>
  )
}

export function OrgDetail({ id }: { id: number }) {
  const d = useView<NonNullable<ReturnType<typeof orgView>>>({ k: 'view', view: 'org', id }, [id], 2000)
  if (!d) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="sec">
        <div className="stripe" style={{ background: d.color }} />
        <h2 className="name">{d.name}</h2>
        <div className="sub">{d.kind} · {d.count} members{d.hq ? ` · based in ${d.hq}` : ''}{d.leader >= 0 ? <> · led by <PersonLink id={d.leader} names={d.names} /></> : null}</div>
        {d.desc && <p className="small" style={{ margin: 0 }}>{d.desc}</p>}
      </div>
      {d.rules.length > 0 && <div className="sec"><h3>Rules</h3>{d.rules.map((r) => (
        <div key={r.key} className="card" style={{ padding: '8px 10px' }}>
          <div className="small"><b>{r.n}.</b> {r.text}</div>
          {r.note && <div className="small muted">{r.note}</div>}
        </div>
      ))}</div>}
      {d.rulesLog.length > 0 && <div className="sec"><h3>The rules, enforced</h3>{d.rulesLog.map((l, i) => (
        <div key={i} className="ev"><span className="d">{l.t}</span><span className="t"><b>{l.rule}</b>: <Rich text={l.outcome} names={d.names} /></span></div>
      ))}</div>}
      <div className="sec"><h3>Members</h3>{d.members.map((m) => <div key={m.id} className="kv"><span><PersonLink id={m.id} names={d.names} /></span><span className="small muted">{m.title || m.rank}{m.num != null ? ` · No. ${m.num}` : ''}{m.secret ? ' · secret' : ''}</span></div>)}</div>
    </>
  )
}

export { Rich }

export function StoryDetail({ id }: { id: number }) {
  const d = useView<NonNullable<ReturnType<typeof storyView>>>({ k: 'view', view: 'story', id }, [id], 2000)
  if (!d) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="sec">
        <h2 className="name">{d.title}</h2>
        <div className="sub">{d.from}{d.to ? ` – ${d.to}` : ', still unfolding'}{d.outcome ? `. ${d.outcome}` : ''}</div>
        {d.who.length > 0 && <div className="row">{d.who.slice(0, 10).map((id) => <span key={id} className="chip"><PersonLink id={id} names={d.names} /></span>)}</div>}
      </div>
      <div className="sec"><h3>How it went</h3><EventList events={d.events.slice().reverse()} names={d.names} /></div>
    </>
  )
}
