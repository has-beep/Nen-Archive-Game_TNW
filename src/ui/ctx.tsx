import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Names } from '../sim/api/views'
import { client } from './client'
import type { Request } from '../sim/api/engine'

export type Target = { k: 'person' | 'place' | 'nation' | 'org' | 'event'; id: number }

export interface Nav {
  open: (t: Target) => void
  back: () => void
  stack: Target[]
  tab: string
  setTab: (t: string) => void
  toast: (msg: string) => void
  /** Bumps whenever the world moves, so open views can refresh. */
  tick: number
  follow: number
  run: (r: Request) => Promise<unknown>
  setSpeed: (s: number) => void
  speed: number
  openFight: (eventId: number) => void
}

export const NavCtx = createContext<Nav>(null as unknown as Nav)
export const useNav = () => useContext(NavCtx)

/** Fetches a view and refreshes it as the world moves (at most every `every` ms). */
export function useView<T>(req: Request | null, deps: unknown[], every = 900): T | null {
  const { tick } = useNav()
  const [data, setData] = useState<T | null>(null)
  const last = useRef(0)
  const key = JSON.stringify(req)
  const keyRef = useRef(key)
  useEffect(() => {
    if (!req) { setData(null); return }
    const now = Date.now()
    const changed = keyRef.current !== key
    if (!changed && now - last.current < every && data) return
    keyRef.current = key
    last.current = now
    let live = true
    client.call<T>(req).then((d) => { if (live) setData(d) }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, ...deps])
  return data
}

const TOKEN = /\{([ponl])(\d+)\}/g

/** Text with {p12}-style tokens turned into links. */
export function Rich({ text, names }: { text: string; names?: Names }) {
  const { open } = useNav()
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    const k = m[1] as 'p' | 'o' | 'n' | 'l'
    const id = +m[2]
    const ref = names?.[k]?.[id]
    const kind = k === 'p' ? 'person' : k === 'o' ? 'org' : k === 'n' ? 'nation' : 'place'
    out.push(
      <button key={i++} className={`lk${ref?.dead ? ' dead' : ''}`} style={ref?.c ? { color: k === 'p' ? undefined : ref.c, borderBottomColor: ref.c } : undefined} onClick={() => open({ k: kind, id })}>
        {ref?.n ?? 'someone'}
      </button>,
    )
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

export function PersonLink({ id, names }: { id: number; names?: Names }) {
  return <Rich text={`{p${id}}`} names={names} />
}

export function Bar({ label, v, max = 100, color, div, suffix }: { label: string; v: number; max?: number; color?: string; div?: boolean; suffix?: string }) {
  const pct = div ? Math.abs(v) / max * 50 : Math.max(0, Math.min(100, v / max * 100))
  const style = div ? { left: v >= 0 ? '50%' : `${50 - pct}%`, width: `${pct}%`, background: color || (v >= 0 ? 'var(--primary)' : 'var(--accent)') } : { width: `${pct}%`, background: color }
  return (
    <div className="barline">
      <span className="lab" title={label}>{label}</span>
      <div className={`track${div ? ' div' : ''}`}><i style={style} /></div>
      <span className="num">{Math.round(v)}{suffix || ''}</span>
    </div>
  )
}

export function useToast(): [string | null, (s: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number>(0)
  const show = useCallback((s: string) => {
    setMsg(s)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setMsg(null), 3200)
  }, [])
  return [msg, show]
}

export const NEN_COLOR = ['#22c55e', '#8b5cf6', '#ef4444', '#3b82f6', '#808080', '#f97316']
export const NEN_NAME = ['Enhancer', 'Transmuter', 'Conjurer', 'Specialist', 'Manipulator', 'Emitter']
