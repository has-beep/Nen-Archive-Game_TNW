import { useState } from 'react'
import type { EventLite, Names, eventView, chronicleView } from '../../sim/api/views'
import { Rich, useNav, useView } from '../ctx'

export function EventList({ events, names, max = 200 }: { events: EventLite[]; names: Names; max?: number }) {
  const { open, openFight } = useNav()
  if (!events.length) return <div className="empty">Nothing yet.</div>
  return (
    <div>
      {events.slice(0, max).map((e) => (
        <div key={e.id} className={`ev i${e.imp}`}>
          <span className="d">{e.date}</span>
          <span className="t">
            <Rich text={e.text} names={names} />
            {e.cause != null && <button className="more" onClick={() => open({ k: 'event', id: e.id })}>why?</button>}
            {e.fight && <button className="more" onClick={() => openFight(e.id)}>watch</button>}
          </span>
        </div>
      ))}
    </div>
  )
}

const TYPES = ['', 'fight', 'war', 'politics', 'exam', 'calamity', 'expedition', 'disaster', 'romance', 'bond', 'nen', 'faction', 'vow', 'crime', 'quest', 'death']

export function Chronicle() {
  const [imp, setImp] = useState(3)
  const [type, setType] = useState('')
  const data = useView<ReturnType<typeof chronicleView>>({ k: 'view', view: 'chronicle', opts: { minImp: imp, type: type || undefined, limit: 150 } }, [imp, type], 1200)
  return (
    <>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="ch-imp">Show events that matter at least this much</label>
          <input id="ch-imp" type="range" min={1} max={5} value={imp} onChange={(e) => setImp(+e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ch-type">Kind</label>
          <select id="ch-type" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{t || 'everything'}</option>)}</select>
        </div>
      </div>
      {data ? <EventList events={data.events} names={data.names} /> : <div className="empty">Loading…</div>}
    </>
  )
}

export function EventDetail({ id }: { id: number }) {
  const { openFight } = useNav()
  const d = useView<NonNullable<ReturnType<typeof eventView>>>({ k: 'view', view: 'event', id }, [id], 5000)
  if (!d) return <div className="empty">Loading…</div>
  return (
    <>
      <div className="sec">
        <h3>{d.event.date}</h3>
        <div style={{ fontSize: 15 }}><Rich text={d.event.text} names={d.names} /></div>
        {d.fight ? <button className="btn primary small" style={{ alignSelf: 'flex-start' }} onClick={() => openFight(id)}>Watch the fight</button> : null}
      </div>
      {d.chain.length > 0 && <div className="sec"><h3>What led to it</h3><EventList events={d.chain} names={d.names} /></div>}
      {d.after.length > 0 && <div className="sec"><h3>What it led to</h3><EventList events={d.after} names={d.names} /></div>}
    </>
  )
}
