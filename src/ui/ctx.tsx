import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Names } from '../sim/api/views'
import { client } from './client'
import type { Request } from '../sim/api/engine'

export type Target = { k: 'person' | 'place' | 'nation' | 'org' | 'event' | 'story'; id: number }

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
    // An inline link, so a long name wraps with the sentence instead of
    // jumping to the next line as a block. No href: a middle-click must not
    // open a second copy of the game in a new tab.
    out.push(
      <span key={i++} role="link" tabIndex={0} className={`lk lk-${k}${ref?.dead ? ' dead' : ''}`}
        style={ref?.c ? ({ '--lc': ref.c, color: k === 'p' ? undefined : `color-mix(in srgb, ${ref.c} 55%, var(--fg))`, textDecorationColor: k === 'p' ? undefined : ref.c } as CSSProperties) : undefined}
        onClick={() => open({ k: kind, id })}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open({ k: kind, id }) } }}>
        {ref?.n ?? 'someone'}
      </span>,
    )
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

/** A person's mark when there is no portrait: their initials on their Nen colour. */
export function Avatar({ name, c, size = 44, dead, own }: { name: string; c?: string; size?: number; dead?: boolean; own?: boolean }) {
  const w = name.trim().split(/\s+/)
  const ini = (w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : '')
  return (
    <span className={`av${dead ? ' dead' : ''}${own ? ' own' : ''}`} aria-hidden="true"
      style={{ '--c': c || 'var(--muted-fg)', width: size, height: size, fontSize: Math.round(size * (ini.length > 1 ? 0.36 : 0.44)) } as CSSProperties}>
      {ini.toUpperCase()}
    </span>
  )
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
