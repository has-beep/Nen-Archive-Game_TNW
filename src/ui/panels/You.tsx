import { useEffect, useState } from 'react'
import type { playerView, searchView } from '../../sim/api/views'
import { client } from '../client'
import { PersonLink, Rich, useNav, useView } from '../ctx'
import type { PlaceDot } from '../components/MapView'

type PlV = ReturnType<typeof playerView>

const TIERS = [
  { k: 'free', n: 'Free', d: '1 character of your own, 1 designed Hatsu, slow influence (20 max).' },
  { k: 'supporter', n: 'Supporter', d: '2 characters, faster influence (40 max), 2 whispers at once.' },
  { k: 'coffee', n: 'Coffee', d: '10 characters, 3 designed Hatsu each, influence to 100, prodigies and pre-awakened starts, shared Weekly Worlds and the scenario lab on the Archive.' },
] as const

export function You({ places, onCreate, onForge, onNew }: { places: PlaceDot[]; onCreate: () => void; onForge: (pid: number) => void; onNew: () => void }) {
  const nav = useNav()
  const d = useView<PlV>({ k: 'view', view: 'player' }, [], 700)
  if (!d) return <div className="empty">Loading…</div>
  const choose = (id: number, k: string, forge: boolean, pid: number) => {
    if (k === 'forge' && forge) { onForge(pid); return }
    nav.run({ k: 'choose', id, option: k }).then((r) => nav.toast((r as { msg: string }).msg))
  }
  return (
    <>
      <div className="sec">
        <h3>Your influence</h3>
        <div className="row"><div className="meter" style={{ width: 160 }}><i style={{ width: `${d.influence / d.max * 100}%` }} /></div><span className="mono small">{d.influence} / {d.max}, +{d.perDay}/day</span></div>
        <div className="small muted">You cannot command anyone. Influence buys nudges: a rumour, a meeting, an urge. People still decide for themselves, and refuse what goes against who they are.</div>
      </div>
      <div className="sec">
        <h3>Crossroads waiting for you {d.crossroads.length > 0 && <span className="badge">{d.crossroads.length}</span>}</h3>
        {d.crossroads.length ? d.crossroads.map((c) => (
          <div key={c.id} className="card">
            <div className="ttl"><span>{c.title}</span><span className="small muted">{c.left} days to decide</span></div>
            <div className="small"><PersonLink id={c.pid} names={d.names} />: {c.prompt}</div>
            <div className="opts">
              {c.options.map((o) => (
                <button key={o.k} className="opt" onClick={() => choose(c.id, o.k, c.forge, c.pid)}>
                  <b>{o.label}</b><span className="small">{o.desc}</span>
                  <span className="fit" title="How well this fits who they are"><i style={{ width: `${Math.round(o.fit * 100)}%` }} /></span>
                </button>
              ))}
            </div>
          </div>
        )) : <div className="small muted">Nothing needs you right now. When one of your characters reaches a choice that matters (a death, a vow, an invitation, a Hatsu ready to be born) it waits here, and the world pauses for it.</div>}
      </div>
      <div className="sec">
        <h3>Your characters ({d.owned.length} / {d.ownedMax})</h3>
        {d.owned.length ? d.owned.map((id) => <div key={id} className="kv"><span><PersonLink id={id} names={d.names} /></span><span className="row" style={{ gap: 4 }}><button className="btn small" onClick={() => nav.run({ k: 'follow', id })}>Follow</button><button className="btn small" onClick={() => onForge(id)}>Forge</button></span></div>) : <div className="small muted">You are only watching. Guide a character from their sheet, or make your own.</div>}
        <div className="row"><button className="btn primary" onClick={onCreate}>Create a character</button><button className="btn" onClick={onNew}>New world</button></div>
      </div>
      <Fate places={places} owned={d.owned} cost={d.fateCost} names={d.names} />
      <div className="sec">
        <h3>Tier</h3>
        <div className="small muted">Inside the Nen Archive this follows your Patreon tier. Here you can try each one.</div>
        {TIERS.map((t) => (
          <label key={t.k} className="card" style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <input type="radio" name="tier" checked={d.tier === t.k} onChange={() => nav.run({ k: 'tier', tier: t.k }).then(() => nav.toast(`${t.n} tier.`))} />
            <span><b>{t.n}</b><br /><span className="small">{t.d}</span></span>
          </label>
        ))}
      </div>
    </>
  )
}

function PersonPick({ id, value, onChange, label }: { id: string; value: number | null; onChange: (v: number | null, n?: string) => void; label: string }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ReturnType<typeof searchView>>([])
  useEffect(() => {
    if (q.length < 2) { setRes([]); return }
    let live = true
    client.call<ReturnType<typeof searchView>>({ k: 'view', view: 'search', q }).then((r) => { if (live) setRes(r) })
    return () => { live = false }
  }, [q])
  return (
    <div className="field" style={{ position: 'relative' }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={q} placeholder="Type a name" onChange={(e) => { setQ(e.target.value); onChange(null) }} />
      {res.length > 0 && value == null && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, maxHeight: 180, overflow: 'auto', padding: 4 }}>
          {res.filter((r) => r.alive).map((r) => <button key={r.id} className="btn small" style={{ justifyContent: 'flex-start', border: 0 }} onClick={() => { onChange(r.id, r.name); setQ(r.name); setRes([]) }}><i className="dot" style={{ background: r.c || '#94a3b8' }} />{r.name} <span className="muted">· {r.role}</span></button>)}
        </div>
      )}
    </div>
  )
}

const ACTS = [['train', 'Train'], ['social', 'Seek company'], ['travel', 'Wander off'], ['rest', 'Rest'], ['work', 'Work'], ['study', 'Study'], ['romance', 'Spend time with someone they love']] as const

function Fate({ places, owned, cost, names }: { places: PlaceDot[]; owned: number[]; cost: Record<string, number>; names: PlV['names'] }) {
  const nav = useNav()
  const [k, setK] = useState<'whisper' | 'rumor' | 'meet' | 'send' | 'gift' | 'bounty'>('whisper')
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  const [pl, setPl] = useState<number>(places.find((p) => p.key === 'yorknew')?.id ?? 0)
  const [act, setAct] = useState('train')
  const [amt, setAmt] = useState(10)
  const ps = places.filter((p) => !p.hidden && !p.beyond)
  const go = () => {
    const args: Record<string, number | string> = {}
    if (k === 'whisper') { if (a == null) return; args.target = a; args.act = act }
    if (k === 'rumor') { if (a == null) return; args.subject = a; args.place = pl; args.kind = 'whereabouts' }
    if (k === 'meet') { if (a == null || b == null) return; args.a = a; args.b = b; args.place = pl }
    if (k === 'send') { args.who = owned[0]; args.place = pl }
    if (k === 'gift' || k === 'bounty') { if (a == null) return; args.target = a; args.amount = amt }
    nav.run({ k: 'fate', fate: k, args }).then((r) => nav.toast((r as { msg: string }).msg))
  }
  return (
    <div className="sec">
      <h3>Nudge fate</h3>
      <div className="row">{(['whisper', 'rumor', 'meet', 'send', 'gift', 'bounty'] as const).map((x) => <button key={x} className={`btn small${k === x ? ' primary' : ''}`} onClick={() => setK(x)}>{x[0].toUpperCase() + x.slice(1)} · {cost[x]}</button>)}</div>
      <div className="small muted">
        {k === 'whisper' && 'Plant an urge in someone. It only works if they already lean that way.'}
        {k === 'rumor' && 'Start a rumour that someone was seen in a place. People who care about them will go looking.'}
        {k === 'meet' && 'Ask two people your character knows to come to the same place. They may not.'}
        {k === 'send' && `Send ${owned.length ? 'your first character' : 'your character'} somewhere.`}
        {k === 'gift' && 'Your character gives someone money. Gifts make friends, and debts.'}
        {k === 'bounty' && 'Your character posts a bounty. Hunters and worse may take it.'}
      </div>
      {(k !== 'send') && <PersonPick id="fate-a" label={k === 'meet' ? 'First person' : 'Who'} value={a} onChange={(v) => setA(v)} />}
      {k === 'meet' && <PersonPick id="fate-b" label="Second person" value={b} onChange={(v) => setB(v)} />}
      {(k === 'rumor' || k === 'meet' || k === 'send') && (
        <div className="field"><label htmlFor="fate-pl">Where</label><select id="fate-pl" value={pl} onChange={(e) => setPl(+e.target.value)}>{ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      )}
      {k === 'whisper' && <div className="field"><label htmlFor="fate-act">The urge</label><select id="fate-act" value={act} onChange={(e) => setAct(e.target.value)}>{ACTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>}
      {(k === 'gift' || k === 'bounty') && <div className="field"><label htmlFor="fate-amt">Million Jenny</label><input id="fate-amt" type="number" min={1} value={amt} onChange={(e) => setAmt(+e.target.value)} /></div>}
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={go}>Spend {cost[k]} influence</button>
      {owned.length === 0 && (k === 'send' || k === 'gift' || k === 'bounty' || k === 'meet') && <div className="small" style={{ color: 'var(--accent)' }}>This needs a character of your own.</div>}
      <span hidden><Rich text="" names={names} /></span>
    </div>
  )
}
