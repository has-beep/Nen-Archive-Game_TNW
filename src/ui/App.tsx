import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Frame } from '../sim/api/views'
import type { Request } from '../sim/api/engine'
import { client } from './client'
import { NavCtx, Rich, useToast, type Nav, type Target } from './ctx'
import { MapView, type PlaceDot } from './components/MapView'
import { Sheet } from './panels/Sheet'
import { Chronicle, EventDetail } from './panels/Chronicle'
import { NationDetail, OrgDetail, PlaceDetail, WorldPanel } from './panels/World'
import { Beyond, Legends } from './panels/Beyond'
import { You } from './panels/You'
import { Cast, Creator, FightReplay, Forge, NewWorld } from './modals/Modals'
import { loadSave, writeSave } from './save'

const SPEEDS = [
  { n: 'Pause', days: 0, every: 0 },
  { n: '1 day', days: 1, every: 900 },
  { n: 'Fast', days: 1, every: 260 },
  { n: 'Faster', days: 4, every: 160 },
  { n: 'Years', days: 15, every: 60 },
]

const TABS = [['follow', 'Following'], ['chronicle', 'Chronicle'], ['world', 'World'], ['beyond', 'Beyond the lake'], ['legends', 'Legends'], ['you', 'You']] as const

export function App() {
  const [ready, setReady] = useState(false)
  const [frame, setFrame] = useState<Frame | null>(null)
  const [places, setPlaces] = useState<PlaceDot[]>([])
  const [speed, setSpeed] = useState(1)
  const [tab, setTab] = useState<string>('follow')
  const [stack, setStack] = useState<Target[]>([])
  const [tick, setTick] = useState(0)
  const [modal, setModal] = useState<null | { k: 'new' } | { k: 'cast' } | { k: 'create' } | { k: 'forge'; pid: number } | { k: 'fight'; id: number }>(null)
  const [toastMsg, toast] = useToast()
  const [ticker, setTicker] = useState<Frame['ticker']>([])
  const [tickNames, setTickNames] = useState<Frame['names']>({ p: {}, o: {}, n: {}, l: {} })
  const busy = useRef(false)
  const lastCross = useRef(0)

  const refreshStatic = useCallback(async () => {
    setPlaces(await client.call<PlaceDot[]>({ k: 'view', view: 'places' }))
  }, [])
  const pull = useCallback(async () => {
    const f = await client.call<Frame>({ k: 'frame', minImp: 3 })
    setFrame(f)
    if (f.ticker.length) { setTicker((t) => [...f.ticker.slice().reverse(), ...t].slice(0, 40)); setTickNames((n) => ({ p: { ...n.p, ...f.names.p }, o: { ...n.o, ...f.names.o }, n: { ...n.n, ...f.names.n }, l: { ...n.l, ...f.names.l } })) }
    setTick((x) => x + 1)
    // A choice for the player: stop the world and say so.
    if (f.crossroads > lastCross.current) { setSpeed(0); toast('One of your characters has reached a crossroads.'); setTab('you'); setStack([]) }
    lastCross.current = f.crossroads
    return f
  }, [toast])

  const startWorld = useCallback(async (o: { seed: number; ants?: 'random' | 'yes' | 'no'; disasters?: boolean; expeditions?: boolean; plotArmor?: boolean; lethality?: number }) => {
    setSpeed(0)
    await client.call({ k: 'new', opts: { seed: o.seed, ants: o.ants ?? 'random', laws: { disasters: o.disasters ?? true, expeditions: o.expeditions ?? true, plotArmor: o.plotArmor ?? false, lethality: o.lethality ?? 0.5 } } })
    setTicker([])
    setStack([])
    setTab('follow')
    await refreshStatic()
    await pull()
  }, [pull, refreshStatic])

  // Boot: start the engine and a world, so the first thing on screen is a living one.
  useEffect(() => {
    (async () => {
      await client.start()
      await startWorld({ seed: 1999 })
      setReady(true)
      setSpeed(1)
    })()
  }, [startWorld])

  // The clock.
  useEffect(() => {
    const sp = SPEEDS[speed]
    if (!ready || !sp.days) return
    let live = true
    let timer = 0
    const loop = async () => {
      if (!live) return
      if (!busy.current) {
        busy.current = true
        try {
          await client.call({ k: 'step', days: sp.days })
          await pull()
          if (sp.days > 1 && Math.random() < 0.1) await refreshStatic()
        } finally { busy.current = false }
      }
      if (live) timer = window.setTimeout(loop, sp.every)
    }
    timer = window.setTimeout(loop, sp.every)
    return () => { live = false; window.clearTimeout(timer) }
  }, [speed, ready, pull, refreshStatic])

  const nav: Nav = useMemo(() => ({
    open: (t) => setStack((s) => (s.length && s[s.length - 1].k === t.k && s[s.length - 1].id === t.id ? s : [...s, t].slice(-12))),
    back: () => setStack((s) => s.slice(0, -1)),
    stack, tab,
    setTab: (t) => { setTab(t); setStack([]) },
    toast, tick, follow: frame?.follow ?? 0,
    run: async (r: Request) => { const res = await client.call(r); await pull(); return res },
    setSpeed, speed,
    openFight: (id) => setModal({ k: 'fight', id }),
  }), [stack, tab, toast, tick, frame?.follow, pull, speed])

  const top = stack[stack.length - 1]
  const save = async () => { const json = await client.call<string>({ k: 'save' }); const ok = await writeSave(json); toast(ok ? 'World saved in this browser.' : 'This browser would not let the world be saved.') }
  const load = async () => { const json = await loadSave(); if (!json) { toast('No saved world in this browser.'); return } setSpeed(0); await client.call({ k: 'load', json }); await refreshStatic(); await pull(); toast('World loaded.') }

  return (
    <NavCtx.Provider value={nav}>
      <div className="nw">
        <header className="bar">
          <div className="brand"><b>Nen <i>World</i></b><span>a Nen Archive simulation</span></div>
          <span className="date" aria-live="polite">{frame?.date ?? '…'}</span>
          <div className="speed" role="group" aria-label="Speed">
            {SPEEDS.map((s, i) => <button key={s.n} aria-pressed={speed === i} onClick={() => setSpeed(i)}>{i === 0 ? '❚❚' : s.n}</button>)}
          </div>
          <div className="infl" title="Influence: what you can spend to nudge fate">
            <span>Influence</span><div className="meter"><i style={{ width: `${frame ? frame.influence / frame.influenceMax * 100 : 0}%` }} /></div><span className="mono">{frame?.influence ?? 0}</span>
          </div>
          <button className="btn small" onClick={() => setModal({ k: 'cast' })}>Choose a character</button>
          <button className="btn small" onClick={save}>Save</button>
          <button className="btn small" onClick={load}>Load</button>
        </header>
        <div className="nw-main">
          <MapView places={places} frame={frame} />
          <section className="panel" aria-label="Details">
            <nav className="tabs" role="tablist">
              {TABS.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k && !top} onClick={() => nav.setTab(k)}>
                  {l}{k === 'you' && frame && frame.crossroads > 0 && <span className="badge">{frame.crossroads}</span>}{k === 'beyond' && frame && frame.expeditions > 0 && <span className="chip" style={{ padding: '0 6px' }}>{frame.expeditions}</span>}
                </button>
              ))}
            </nav>
            {top && <div className="crumbs"><button className="btn small" onClick={nav.back}>Back</button><span>{stack.length > 1 ? `${stack.length} deep` : ''}</span></div>}
            <div className="scroll">
              {!ready && <div className="empty">Building the world: nations, the Hunter Association, the Phantom Troupe, the Zoldyck family, and a few hundred people with somewhere to be…</div>}
              {ready && top?.k === 'person' && <Sheet key={`p${top.id}`} id={top.id} />}
              {ready && top?.k === 'place' && <PlaceDetail key={`l${top.id}`} id={top.id} />}
              {ready && top?.k === 'nation' && <NationDetail key={`n${top.id}`} id={top.id} />}
              {ready && top?.k === 'org' && <OrgDetail key={`o${top.id}`} id={top.id} />}
              {ready && top?.k === 'event' && <EventDetail key={`e${top.id}`} id={top.id} />}
              {ready && !top && tab === 'follow' && frame && <Sheet key={`f${frame.follow}`} id={frame.follow} />}
              {ready && !top && tab === 'chronicle' && <Chronicle />}
              {ready && !top && tab === 'world' && <WorldPanel />}
              {ready && !top && tab === 'beyond' && <Beyond />}
              {ready && !top && tab === 'legends' && <Legends />}
              {ready && !top && tab === 'you' && <You places={places} onCreate={() => setModal({ k: 'create' })} onForge={(pid) => setModal({ k: 'forge', pid })} onNew={() => setModal({ k: 'new' })} />}
            </div>
          </section>
        </div>
        <footer className="ticker" aria-live="polite">
          <span className="lab">Latest</span>
          <span className="tx">{ticker[0] ? <><span className="mono small muted">{ticker[0].date} </span><Rich text={ticker[0].text} names={tickNames} /></> : 'The world is quiet.'}</span>
        </footer>
      </div>
      {modal?.k === 'new' && <NewWorld onClose={() => setModal(null)} onStart={(o) => { setModal(null); startWorld(o).then(() => { setModal({ k: 'cast' }); setSpeed(0) }) }} />}
      {modal?.k === 'cast' && <Cast onClose={() => setModal(null)} onCreate={() => setModal({ k: 'create' })} />}
      {modal?.k === 'create' && <Creator places={places} onClose={() => setModal(null)} />}
      {modal?.k === 'forge' && <Forge pid={modal.pid} onClose={() => setModal(null)} />}
      {modal?.k === 'fight' && <FightReplay eventId={modal.id} onClose={() => setModal(null)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </NavCtx.Provider>
  )
}
