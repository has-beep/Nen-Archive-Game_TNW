import { useEffect, useRef, useState } from 'react'
import { LAND, MOUNTAINS, REGION_LABELS, MAP_W, MAP_H } from '../../data/geography'
import type { Frame } from '../../sim/api/views'
import { useNav } from '../ctx'

export interface PlaceDot { id: number; key: string; name: string; x: number; y: number; kind: string; hidden: boolean; pop: number; beyond: boolean; known: boolean }

interface Props { places: PlaceDot[]; frame: Frame | null }

/** Deterministic wobble so coastlines look drawn, not compass-made. */
function wob(seed: number, a: number) {
  return Math.sin(a * 3 + seed) * 0.06 + Math.sin(a * 7 + seed * 1.7) * 0.035 + Math.sin(a * 13 + seed * 0.3) * 0.018
}

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

export function MapView({ places, frame }: Props) {
  const { open, follow } = useNav()
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const cam = useRef({ x: MAP_W / 2, y: MAP_H / 2, s: 0 })
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const [followCam, setFollowCam] = useState(false)
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null)
  const [, force] = useState(0)
  const anim = useRef(0)

  // Fit the whole lake on first layout.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      if (!cam.current.s) cam.current.s = Math.min(r.width / (MAP_W + 2), r.height / (MAP_H + 2))
      force((n) => n + 1)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The follow camera eases toward the followed person.
  useEffect(() => {
    if (!followCam || !frame) return
    const d = frame.dots.find((x) => x.id === follow)
    if (!d) return
    cam.current.x += (d.x - cam.current.x) * 0.35
    cam.current.y += (d.y - cam.current.y) * 0.35
  }, [frame, followCam, follow])

  // Draw.
  useEffect(() => {
    const cv = ref.current, el = wrap.current
    if (!cv || !el) return
    let raf = 0
    const draw = () => {
      anim.current = (anim.current + 1) % 100000
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr) }
      const g = cv.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const { x: cx, y: cy, s } = cam.current
      const W = r.width, H = r.height
      const X = (x: number) => (x - cx) * s + W / 2
      const Y = (y: number) => (y - cy) * s + H / 2
      const water = css('--water'), deep = css('--water-deep'), land = css('--land'), edge = css('--land-edge'), line = css('--land-line'), text = css('--map-text'), seaText = css('--map-sea-text'), beyond = css('--beyond')
      g.fillStyle = water
      g.fillRect(0, 0, W, H)
      // The lake's rim: past it, the Dark Continent.
      g.fillStyle = deep
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(X(MAP_W / 2), Y(MAP_H / 2), (MAP_W / 2 + 4 + i * 6) * s, 0, Math.PI * 2); g.globalAlpha = 0.18; g.fill() }
      g.globalAlpha = 1
      // Coasts: an outline pass, then the land on top so only outer edges show.
      const blob = (bx: number, by: number, br: number, seed: number, grow: number) => {
        g.beginPath()
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * Math.PI * 2
          const rr = (br + grow) * (1 + wob(seed, a))
          const px = X(bx + Math.cos(a) * rr), py = Y(by + Math.sin(a) * rr)
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py)
        }
        g.closePath()
      }
      let seed = 1
      for (const lm of LAND) for (const [bx, by, br] of lm.b) { blob(bx, by, br, seed++, 0.35); g.fillStyle = lm.key === 'dc' ? beyond : edge; g.fill() }
      seed = 1
      for (const lm of LAND) for (const [bx, by, br] of lm.b) { blob(bx, by, br, seed++, 0); g.fillStyle = lm.key === 'dc' ? beyond : land; g.fill() }
      // Mountains as little ridges.
      g.strokeStyle = line
      g.lineWidth = 1.2
      for (const [mx, my, mr] of MOUNTAINS) {
        for (let k = 0; k < Math.round(mr * 2.2); k++) {
          const a = k * 2.4, d = (k % 3) * mr * 0.25
          const px = X(mx + Math.cos(a) * d), py = Y(my + Math.sin(a) * d)
          const h = Math.max(3, s * 0.7)
          g.beginPath(); g.moveTo(px - h, py + h * 0.6); g.lineTo(px, py - h * 0.6); g.lineTo(px + h, py + h * 0.6); g.stroke()
        }
      }
      // Region names.
      g.textAlign = 'center'
      for (const lb of REGION_LABELS) {
        g.font = `${lb.sea ? 'italic ' : ''}600 ${Math.max(9, Math.min(13, s * 0.9))}px Inter, system-ui, sans-serif`
        g.fillStyle = lb.sea ? seaText : text
        g.globalAlpha = 0.55
        g.fillText(lb.sea ? lb.n : lb.n.toUpperCase(), X(lb.x), Y(lb.y))
      }
      g.globalAlpha = 1
      // Hazards: a soft pulse, sized by severity.
      if (frame) {
        const pulse = 0.85 + Math.sin(anim.current / 9) * 0.15
        for (const h of frame.hazards) {
          const rad = (1.2 + h.sev * 2.8) * s * pulse
          const gr = g.createRadialGradient(X(h.x), Y(h.y), 0, X(h.x), Y(h.y), rad)
          gr.addColorStop(0, h.color + 'aa'); gr.addColorStop(1, h.color + '00')
          g.fillStyle = gr
          g.beginPath(); g.arc(X(h.x), Y(h.y), rad, 0, Math.PI * 2); g.fill()
        }
        // War fronts.
        g.strokeStyle = css('--accent'); g.lineWidth = 2
        for (const f of frame.fronts) {
          const px = X(f.x), py = Y(f.y), k = Math.max(4, s * 0.6)
          g.beginPath(); g.moveTo(px - k, py - k); g.lineTo(px + k, py + k); g.moveTo(px + k, py - k); g.lineTo(px - k, py + k); g.stroke()
        }
      }
      // Places.
      for (const p of places) {
        if (p.hidden && !p.beyond && p.kind !== 'ship') continue
        const px = X(p.x), py = Y(p.y)
        if (px < -40 || py < -40 || px > W + 40 || py > H + 40) continue
        const city = p.kind === 'city'
        if (p.beyond) {
          g.fillStyle = beyond; g.strokeStyle = css('--accent'); g.lineWidth = 1.5
          g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill(); g.stroke()
          g.fillStyle = text; g.font = `600 10px Inter, system-ui, sans-serif`; g.textAlign = 'center'
          g.fillText(p.known ? p.name : '?', px, py - 9)
          continue
        }
        g.fillStyle = city ? text : edge
        g.beginPath(); g.arc(px, py, city ? 3.2 : 2.4, 0, Math.PI * 2); g.fill()
        if (s > 5 || city) {
          g.fillStyle = text; g.font = `${city ? 600 : 500} ${city ? 11 : 10}px Inter, system-ui, sans-serif`; g.textAlign = 'left'
          g.fillText(p.name, px + 6, py + 3.5)
        }
      }
      // People.
      if (frame) {
        for (const d of frame.dots) {
          const px = X(d.x), py = Y(d.y)
          if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue
          const rad = d.f ? 5 : d.big ? 3 : 1.8
          g.fillStyle = d.c
          g.globalAlpha = d.big || d.f || d.own ? 1 : 0.75
          g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill()
          g.globalAlpha = 1
          if (d.own || d.f) { g.strokeStyle = d.f ? css('--fg') : css('--gold'); g.lineWidth = 2; g.beginPath(); g.arc(px, py, rad + 3, 0, Math.PI * 2); g.stroke() }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [places, frame])

  const toWorld = (ex: number, ey: number) => {
    const r = wrap.current!.getBoundingClientRect()
    const { x, y, s } = cam.current
    return { x: (ex - r.left - r.width / 2) / s + x, y: (ey - r.top - r.height / 2) / s + y, lx: ex - r.left, ly: ey - r.top }
  }
  const pick = (ex: number, ey: number) => {
    const p = toWorld(ex, ey)
    const s = cam.current.s
    let best: { k: 'person' | 'place'; id: number; n: string; d: number } | null = null
    if (frame) for (const d of frame.dots) {
      const dd = Math.hypot(d.x - p.x, d.y - p.y) * s
      if (dd < (d.f ? 9 : d.big ? 7 : 5) && (!best || dd < best.d)) best = { k: 'person', id: d.id, n: frame.names.p[d.id]?.n || '', d: dd }
    }
    if (!best) for (const pl of places) {
      if (pl.hidden && !pl.beyond && pl.kind !== 'ship') continue
      const dd = Math.hypot(pl.x - p.x, pl.y - p.y) * s
      if (dd < 10 && (!best || dd < best.d)) best = { k: 'place', id: pl.id, n: pl.beyond && !pl.known ? 'Unknown region' : pl.name, d: dd }
    }
    return { best, p }
  }

  return (
    <div className="map-wrap" ref={wrap}>
      <canvas
        ref={ref}
        aria-label="Map of the world inside Lake Mobius"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false } }}
        onPointerMove={(e) => {
          const d = drag.current
          if (d) {
            const dx = e.clientX - d.x, dy = e.clientY - d.y
            if (Math.abs(dx) + Math.abs(dy) > 4) { d.moved = true; setFollowCam(false) }
            cam.current.x = d.cx - dx / cam.current.s
            cam.current.y = d.cy - dy / cam.current.s
            return
          }
          const { best, p } = pick(e.clientX, e.clientY)
          setTip(best ? { x: p.lx + 12, y: p.ly + 12, t: best.n } : null)
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (d && !d.moved) {
            const { best } = pick(e.clientX, e.clientY)
            if (best) open({ k: best.k, id: best.id })
          }
        }}
        onPointerLeave={() => setTip(null)}
        onWheel={(e) => {
          const before = toWorld(e.clientX, e.clientY)
          const f = Math.exp(-e.deltaY * 0.0015)
          cam.current.s = Math.max(3, Math.min(60, cam.current.s * f))
          const after = toWorld(e.clientX, e.clientY)
          cam.current.x += before.x - after.x
          cam.current.y += before.y - after.y
        }}
      />
      <div className="map-tools">
        <button className="btn small" onClick={() => { cam.current.s = Math.min(60, cam.current.s * 1.4) }} aria-label="Zoom in">＋</button>
        <button className="btn small" onClick={() => { cam.current.s = Math.max(3, cam.current.s / 1.4) }} aria-label="Zoom out">－</button>
        <button className="btn small" onClick={() => { const r = wrap.current!.getBoundingClientRect(); cam.current = { x: MAP_W / 2, y: MAP_H / 2, s: Math.min(r.width / (MAP_W + 2), r.height / (MAP_H + 2)) }; setFollowCam(false) }}>Whole lake</button>
        <button className={`btn small${followCam ? ' primary' : ''}`} onClick={() => { setFollowCam((v) => !v); if (!followCam) cam.current.s = Math.max(cam.current.s, 12) }} aria-pressed={followCam}>Follow camera</button>
      </div>
      {tip && <div className="map-tip" style={{ left: tip.x, top: tip.y }}>{tip.t}</div>}
      <div className="legend">
        {[['Enhancer', 'var(--enh)'], ['Transmuter', 'var(--tra)'], ['Emitter', 'var(--emi)'], ['Conjurer', 'var(--con)'], ['Manipulator', 'var(--man)'], ['Specialist', 'var(--spe)'], ['No Nen', '#94a3b8']].map(([n, c]) => (
          <span key={n}><i className="dot" style={{ background: c }} />{n}</span>
        ))}
      </div>
    </div>
  )
}
