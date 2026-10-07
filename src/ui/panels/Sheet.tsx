import { useState, type CSSProperties } from 'react'
import type { personView } from '../../sim/api/views'
import { Avatar, Bar, NEN_COLOR, NEN_NAME, PersonLink, Rich, useNav, useView } from '../ctx'
import { EventList } from './Chronicle'

type PV = NonNullable<ReturnType<typeof personView>>

// Enhancer at the top, then clockwise: Transmuter, Conjurer, Specialist,
// Manipulator, Emitter, as Wing draws it (and as NEN_TYPES is ordered).
const CAT_ORDER = [0, 1, 2, 3, 4, 5]

function Hexagon({ cat, type }: { cat: number[]; type: number }) {
  const R = 74, cx = 150, cy = 112
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] }
  const ring = (r: number) => CAT_ORDER.map((_, i) => pt(i, r).join(',')).join(' ')
  const shape = CAT_ORDER.map((c, i) => pt(i, R * Math.max(0.04, (cat[c] || 0) / 100)).join(',')).join(' ')
  return (
    <div className="hex" style={{ width: '100%', maxWidth: 300, margin: '0 auto' }}>
      <svg viewBox="0 0 300 224" style={{ width: '100%', display: 'block' }} role="img" aria-label="Nen category proficiency">
        {[0.33, 0.66, 1].map((k) => <polygon key={k} points={ring(R * k)} fill="none" stroke="var(--border)" />)}
        <polygon points={shape} fill={NEN_COLOR[type] + '44'} stroke={NEN_COLOR[type]} strokeWidth="2" strokeLinejoin="round" />
        {CAT_ORDER.map((c, i) => {
          const [x, y] = pt(i, R + 16)
          const side = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end'
          return <text key={c} x={x} y={y + 4} textAnchor={side} style={{ fill: c === type ? NEN_COLOR[c] : undefined, fontWeight: c === type ? 800 : undefined }}>{NEN_NAME[c]} <tspan style={{ fontWeight: 500, opacity: 0.75 }}>{cat[c] ?? 0}</tspan></text>
        })}
      </svg>
    </div>
  )
}

export function Sheet({ id }: { id: number }) {
  const nav = useNav()
  const p = useView<PV>({ k: 'view', view: 'person', id }, [id])
  const [tab, setTab] = useState('overview')
  if (!p) return <div className="empty">Loading…</div>
  const n = p.names
  const known = p.nen.awake || p.nen.known
  const nenC = known ? p.nen.color : 'var(--muted-fg)'
  return (
    <>
      <div className="sec">
        <div className="phead" style={{ '--nen': nenC } as CSSProperties}>
          <Avatar name={p.name} c={known ? p.nen.color : undefined} size={48} dead={!p.alive} own={p.owned} />
          <div className="who">
            <h2 className="name">{p.name}</h2>
            <div className="sub">{p.title ? `${p.title} · ` : ''}{p.role} · {p.alive ? `${p.age}` : 'dead'}{p.nation ? ` · ${p.nation}` : ''}</div>
            <div className="row" style={{ gap: 4, marginTop: 6 }}>
              {p.owned && <span className="chip gold">Yours</span>}
              {p.canon && <span className="chip">Canon</span>}
              {p.license && <span className="chip on">Hunter {'★'.repeat(p.license.stars)}</span>}
            </div>
          </div>
        </div>
        <div className="small">
          {p.alive
            ? p.trip ? <>Travelling to {p.trip.to}, {p.trip.days} days out.</> : <>{p.doing}{p.at ? <> in <Rich text={`{l${p.at.id}}`} names={{ ...n, l: { [p.at.id]: { n: p.at.name } } }} /></> : null}.</>
            : <>Died {p.death?.date}: {p.death?.cause}.</>}
          {p.plan && p.alive && <span className="muted"> Plan: {p.plan}.</span>}
        </div>
        <div className="row">
          {!p.followed && <button className="btn small" onClick={() => nav.run({ k: 'follow', id: p.id }).then(() => nav.toast(`Following ${p.short}.`))}>Follow</button>}
          <button className="btn small" aria-pressed={p.watched} onClick={() => nav.run({ k: 'watch', id: p.id, on: !p.watched }).then((r) => nav.toast((r as { msg: string }).msg))}>{p.watched ? '★ Watching' : '☆ Watch'}</button>
          {p.alive && !p.owned && <button className="btn small" onClick={() => nav.run({ k: 'own', id: p.id }).then((r) => nav.toast((r as { msg: string }).msg))}>Guide this character</button>}
          {p.owned && <button className="btn small" onClick={() => nav.run({ k: 'release', id: p.id }).then((r) => nav.toast((r as { msg: string }).msg))}>Let them go</button>}
        </div>
      </div>
      <div className="tabs subtabs" role="tablist" style={{ '--nen': nenC } as CSSProperties}>
        {['overview', 'nen', 'mind', 'bonds', 'life'].map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </div>
      {tab === 'overview' && <Overview p={p} />}
      {tab === 'nen' && <NenTab p={p} />}
      {tab === 'mind' && <Mind p={p} />}
      {tab === 'bonds' && (
        <div className="sec">
          {p.rels.length ? p.rels.map((r) => (
            <div key={r.id} className="card" style={{ padding: '8px 10px' }}>
              <div className="ttl"><span><PersonLink id={r.id} names={n} /></span><span className="row" style={{ gap: 4 }}>{r.bonds.map((b) => <span key={b} className={`chip${/enemy|Former/.test(b) ? ' red' : ''}`}>{b}</span>)}</span></div>
              <Bar label="Feels" v={r.aff} div max={100} />
              <Bar label="Trust" v={r.trust} div max={100} />
              <div className="small muted">They feel {r.theirs > 30 ? 'warmly' : r.theirs > 0 ? 'fine' : r.theirs > -30 ? 'coolly' : 'badly'} toward {p.short} in return{r.fear > 25 ? `. ${p.short} is afraid of them` : ''}{r.attr > 40 ? `. ${p.short} is drawn to them` : ''}.</div>
            </div>
          )) : <div className="empty">{p.short} hardly knows anyone yet.</div>}
        </div>
      )}
      {tab === 'life' && (
        <div className="sec">
          {p.memories.length > 0 && <>
            <h3>What they remember</h3>
            {p.memories.map((m, i) => <div key={i} className="kv"><span>{m.t}</span><span style={{ color: m.val < 0 ? 'var(--accent)' : 'var(--primary)' }}>{m.text}</span></div>)}
          </>}
          <h3>Their story</h3>
          <EventList events={p.life} names={n} />
        </div>
      )}
    </>
  )
}

function Overview({ p }: { p: PV }) {
  const n = p.names
  return (
    <>
      {p.bio && <p className="small" style={{ margin: 0 }}>{p.bio}</p>}
      <div className="sec">
        <div className="vital"><span>Health</span><div className="track"><i style={{ width: `${Math.max(0, p.hp / p.hpMax * 100)}%`, background: 'var(--accent)' }} /></div><span className="num">{p.hp}/{p.hpMax}</span></div>
        <div className="vital"><span>Stamina</span><div className="track"><i style={{ width: `${p.stam}%`, background: 'var(--warn)' }} /></div><span className="num">{p.stam}</span></div>
        {p.nen.awake && <div className="vital"><span>Aura</span><div className="track"><i style={{ width: `${p.nen.aura / Math.max(1, p.nen.auraMax) * 100}%`, background: p.nen.color }} /></div><span className="num">{p.nen.aura.toLocaleString()}</span></div>}
      </div>
      {(p.wounds.length > 0 || p.conds.length > 0) && (
        <div className="row">
          {p.wounds.map((w, i) => <span key={i} className="chip red">{w.perm ? 'lost ' : w.sev === 3 ? 'severe ' : w.sev === 2 ? 'broken ' : 'hurt '}{w.part}{w.bleed ? ', bleeding' : ''}</span>)}
          {p.conds.map((c, i) => <span key={i} className="chip red">{c.k}{c.note && c.note !== c.k ? `: ${c.note}` : ''}{c.left > 0 && c.left < 999 ? ` (${c.left}d)` : ''}</span>)}
        </div>
      )}
      <div className="sec">
        <h3>What they want</h3>
        {p.dreams.length ? p.dreams.map((d, i) => (
          <div key={i} className="barline" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 34px' }}>
            <span title={`Matters to them: ${d.pri}/100`} style={{ textDecoration: d.done ? 'line-through' : undefined, color: d.failed ? 'var(--accent)' : undefined, fontWeight: d.pri >= 80 && !d.done && !d.failed ? 600 : undefined }}><Rich text={d.label} names={n} /></span>
            <div className="track"><i style={{ width: `${d.done ? 100 : d.prog}%`, background: d.done ? 'var(--primary)' : 'var(--gold)' }} /></div>
            <span className="num" style={{ color: d.done ? 'var(--primary)' : d.failed ? 'var(--accent)' : undefined }}>{d.done ? '✓' : d.failed ? '✗' : `${Math.round(d.prog)}%`}</span>
          </div>
        )) : <div className="small muted">Nothing in particular.</div>}
      </div>
      <div className="grid2">
        <div className="kv"><span>Money</span><span className="mono">{p.jenny.toLocaleString()}M J</span></div>
        <div className="kv"><span>Fame</span><span className="mono">{p.fame}</span></div>
        <div className="kv"><span>Power</span><span className="mono">{p.power}</span></div>
        <div className="kv"><span>Infamy</span><span className="mono">{p.infamy}</span></div>
        <div className="kv"><span>Fights</span><span className="mono">{p.stats.wins}W {p.stats.losses}L</span></div>
        <div className="kv"><span>Killed</span><span className="mono">{p.stats.kills}</span></div>
        <div className="kv"><span>Home</span><span>{p.home}</span></div>
        <div className="kv"><span>Bounty</span><span className="mono">{p.bounty ? `${p.bounty}M` : '—'}</span></div>
      </div>
      {p.orgs.length > 0 && <div className="sec"><h3>Belongs to</h3><div className="row">{p.orgs.map((o) => <span key={o.id} className="chip" style={{ borderColor: o.color }}><Rich text={`{o${o.id}}`} names={{ ...n, o: { [o.id]: { n: o.name, c: o.color } } }} />{o.title ? ` · ${o.title}` : o.rank ? ` · ${o.rank}` : ''}</span>)}</div></div>}
      {p.items.length > 0 && <div className="sec"><h3>Carries</h3><div className="row">{p.items.map((it) => <span key={it.id} className={`chip${it.k === 'hope' ? ' gold' : ''}`}>{it.name}</span>)}</div></div>}
    </>
  )
}

function NenTab({ p }: { p: PV }) {
  const nav = useNav()
  if (!p.nen.awake) return (
    <div className="sec">
      <div className="empty">{p.short} has not awakened to Nen. {p.nen.type ? `Water divination says ${p.nen.type}.` : 'Nobody has done water divination for them yet.'} Talent: {p.nen.pot >= 1.3 ? 'rare' : p.nen.pot >= 1 ? 'strong' : p.nen.pot >= 0.7 ? 'ordinary' : 'slight'}.</div>
    </div>
  )
  return (
    <>
      <Hexagon cat={p.nen.cat} type={p.nen.typeIdx} />
      <div className="grid2">
        <div className="kv"><span>Type</span><span style={{ color: `color-mix(in srgb, ${p.nen.color} 70%, var(--fg))`, fontWeight: 700 }}>{p.nen.type || 'Unknown'}</span></div>
        <div className="kv"><span>Level</span><span className="mono">{p.nen.lvl} / {p.nen.cap}</span></div>
        <div className="kv"><span>Aura</span><span className="mono">{p.nen.auraMax.toLocaleString()}</span></div>
        <div className="kv"><span>Talent</span><span className="mono">{p.nen.pot}</span></div>
        {p.nen.lifeSpent > 0 && <div className="kv"><span>Life spent</span><span className="mono">{p.nen.lifeSpent} days</span></div>}
      </div>
      {p.nen.burnedOut && <span className="chip red" style={{ alignSelf: 'flex-start' }}>Burned out by a vow</span>}
      <div className="sec">
        <h3>Techniques</h3>
        <div className="bars">{p.nen.tech.filter((t) => t.v > 0).map((t) => <Bar key={t.k} label={t.k} v={t.v} color={p.nen.color} />)}</div>
        {p.nen.tech.some((t) => t.v <= 0) && <div className="row small muted" style={{ gap: 4 }}>Not yet: {p.nen.tech.filter((t) => t.v <= 0).map((t) => <span key={t.k} className="chip" style={{ textTransform: 'capitalize' }}>{t.k}</span>)}</div>}
      </div>
      <div className="sec">
        <h3>Hatsu</h3>
        {p.nen.hatsu.length ? p.nen.hatsu.map((h) => (
          <div key={h.id} className="card hatsu" style={{ borderLeftColor: h.colors[0]?.c }}>
            <div className="ttl"><span>“{h.name}”{h.stolen ? <span className="chip" style={{ marginLeft: 6 }}>stolen</span> : null}</span><span className="small muted mono">{h.cats}</span></div>
            <div className="small">{h.desc}</div>
            <div className="row">{h.effects.map((e, i) => <span key={i} className="chip">{e}</span>)}</div>
            {h.conds.length > 0 && <div className="small">{h.conds.map((c, i) => <div key={i}><span className="stars">{'★'.repeat(c.stars)}</span> {c.text}</div>)}</div>}
            <div className="small muted">Used {h.uses} times in a fight.</div>
          </div>
        )) : <div className="small muted">No Hatsu yet.{p.owned ? ' When they are ready, you can design it in the Forge.' : ''}</div>}
        {p.owned && <button className="btn small" onClick={() => nav.setTab('you')}>Open the Forge from your crossroads</button>}
      </div>
      {p.nen.vows.length > 0 && <div className="sec"><h3>Vows</h3>{p.nen.vows.map((v, i) => <div key={i} className="card"><span className="stars">{'★'.repeat(v.stars)}</span><span className="small">{v.text}</span></div>)}</div>}
    </>
  )
}

function Mind({ p }: { p: PV }) {
  return (
    <>
      <div className="sec"><h3>Mood</h3><div className="bars">{Object.entries(p.mood).map(([k, v]) => <Bar key={k} label={k} v={v} color={k === 'happy' ? 'var(--primary)' : 'var(--accent)'} />)}</div></div>
      <div className="sec"><h3>Personality</h3><div className="bars">{p.facets.map((f) => <Bar key={f.k} label={f.k} v={f.v} color="var(--muted-fg)" />)}</div></div>
      <div className="sec"><h3>What matters to them</h3><div className="bars">{p.values.map((f) => <Bar key={f.k} label={f.k} v={f.v} div max={100} />)}</div></div>
      <div className="sec"><h3>Needs</h3><div className="bars">{p.needs.map((f) => <Bar key={f.k} label={f.k} v={f.v} color={f.v < 30 ? 'var(--accent)' : 'var(--primary)'} />)}</div></div>
      <div className="sec"><h3>Skills</h3><div className="bars">{p.skills.map((f) => <Bar key={f.k} label={f.k} v={f.v} color="var(--gold)" />)}</div></div>
    </>
  )
}
