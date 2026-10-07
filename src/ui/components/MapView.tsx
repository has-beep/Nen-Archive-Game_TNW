import { useEffect, useRef, useState } from 'react'
import { COAST_LAND, COAST_WATER, MOUNTAINS, REGION_LABELS, MAP_W, MAP_H } from '../../data/geography'
import type { Frame } from '../../sim/api/views'
import { useNav } from '../ctx'

export interface PlaceDot { id: number; key: string; name: string; x: number; y: number; kind: string; hidden: boolean; pop: number; beyond: boolean; known: boolean }

interface Props { places: PlaceDot[]; frame: Frame | null }

/** The traced coastlines as paths in map tiles, built once. */
let PATHS: { land: Path2D; water: Path2D } | null = null
function paths() {
  if (PATHS) return PATHS
  const ring = (path: Path2D, r: number[]) => {
    path.moveTo(r[0], r[1])
    for (let i = 2; i < r.length; i += 2) path.lineTo(r[i], r[i + 1])
    path.closePath()
  }
  const land = new Path2D(), water = new Path2D()
  for (const r of COAST_LAND) ring(land, r)
  for (const r of COAST_WATER) ring(water, r)
  PATHS = { land, water }
  return PATHS
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
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
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
      // Every colour this frame needs, read in one go.
      const cs = getComputedStyle(document.documentElement)
      const tok = (n: string) => cs.getPropertyValue(n).trim() || '#888'
      const water = tok('--water'), deep = tok('--water-deep'), land = tok('--land'), edge = tok('--land-edge'), line = tok('--land-line'),
        text = tok('--map-text'), seaText = tok('--map-sea-text'), region = tok('--map-region'), ring = tok('--dot-ring'),
        gold = tok('--gold'), accent = tok('--accent'), card = tok('--card'), fg = tok('--fg'), bg = tok('--bg')
      g.fillStyle = water
      g.fillRect(0, 0, W, H)
      // The lake's rim: past it, the Dark Continent.
      g.fillStyle = deep
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.ellipse(X(MAP_W / 2), Y(MAP_H / 2), (MAP_W / 2 + 6 + i * 6) * s, (MAP_H / 2 + 6 + i * 6) * s, 0, 0, Math.PI * 2)
        g.globalAlpha = 0.16; g.fill()
      }
      g.globalAlpha = 1
      // Coasts, traced from the official map, drawn like an old atlas: an
      // engraved waterline a few pixels off every shore, the land, its lakes,
      // then the inked coast.
      const { land: LP, water: WP } = paths()
      g.save()
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cx * s), dpr * (H / 2 - cy * s))
      g.lineJoin = 'round'
      g.globalAlpha = 0.3; g.strokeStyle = edge; g.lineWidth = 13 / s; g.stroke(LP)
      g.globalAlpha = 1; g.strokeStyle = water; g.lineWidth = 10 / s; g.stroke(LP)
      g.fillStyle = land; g.fill(LP)
      g.fillStyle = water; g.fill(WP)
      g.strokeStyle = edge; g.lineWidth = Math.max(1.2, Math.min(2, s / 8)) / s; g.stroke(LP); g.stroke(WP)
      g.restore()
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
      // Hazards: a soft pulse, sized by severity.
      if (frame) {
        const pulse = calm ? 1 : 0.85 + Math.sin(anim.current / 9) * 0.15
        for (const h of frame.hazards) {
          const rad = (1.2 + h.sev * 2.8) * s * pulse
          const gr = g.createRadialGradient(X(h.x), Y(h.y), 0, X(h.x), Y(h.y), rad)
          gr.addColorStop(0, h.color + 'aa'); gr.addColorStop(1, h.color + '00')
          g.fillStyle = gr
          g.beginPath(); g.arc(X(h.x), Y(h.y), rad, 0, Math.PI * 2); g.fill()
        }
        // War fronts.
        g.strokeStyle = accent; g.lineWidth = 2
        for (const f of frame.fronts) {
          const px = X(f.x), py = Y(f.y), k = Math.max(4, s * 0.6)
          g.beginPath(); g.moveTo(px - k, py - k); g.lineTo(px + k, py + k); g.moveTo(px + k, py - k); g.lineTo(px - k, py + k); g.stroke()
        }
      }
      // Place dots, and quiet marks for the Dark Continent past the edges.
      const boxes: [number, number, number, number][] = []
      const free = (b: [number, number, number, number]) => b[0] >= 0 && b[2] <= W && b[1] >= 0 && b[3] <= H && !boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])
      const named: { p: PlaceDot; px: number; py: number; city: boolean }[] = []
      const beyondNames: { t: string; px: number; py: number }[] = []
      for (const p of places) {
        if (p.hidden && !p.beyond && p.kind !== 'ship') continue
        const px = X(p.x), py = Y(p.y)
        if (px < -40 || py < -40 || px > W + 40 || py > H + 40) continue
        const city = p.kind === 'city'
        if (p.beyond) {
          if (p.known) {
            g.fillStyle = gold; g.strokeStyle = card; g.lineWidth = 1.5
            g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.fill(); g.stroke()
            beyondNames.push({ t: p.name, px, py: py + 14 })
          } else {
            g.setLineDash([2, 2]); g.strokeStyle = seaText; g.lineWidth = 1.2
            g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
            g.fillStyle = seaText; g.font = 'italic 700 9px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
            g.fillText('?', px, py + 0.5); g.textBaseline = 'alphabetic'
          }
          boxes.push([px - 7, py - 7, px + 7, py + 7])
          continue
        }
        g.fillStyle = city ? text : edge
        g.beginPath(); g.arc(px, py, city ? 3.2 : 2.4, 0, Math.PI * 2); g.fill()
        boxes.push([px - 4, py - 4, px + 4, py + 4])
        if (s > 5 || city) named.push({ p, px, py, city })
      }
      // People: crisp beads with a thin ink ring, one path per colour so
      // hundreds of them stay cheap. The followed person is drawn last.
      let me: Frame['dots'][number] | null = null
      if (frame) {
        const small = new Map<string, Path2D>(), big = new Map<string, Path2D>()
        const rings = new Path2D(), owned = new Path2D()
        for (const d of frame.dots) {
          if (d.f) { me = d; continue }
          const px = X(d.x), py = Y(d.y)
          if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue
          const r0 = d.big ? 3 : 2
          const bucket = d.big ? big : small
          let path = bucket.get(d.c)
          if (!path) { path = new Path2D(); bucket.set(d.c, path) }
          path.moveTo(px + r0, py); path.arc(px, py, r0, 0, Math.PI * 2)
          if (d.big) { rings.moveTo(px + r0, py); rings.arc(px, py, r0, 0, Math.PI * 2) }
          if (d.own) { owned.moveTo(px + r0 + 2.5, py); owned.arc(px, py, r0 + 2.5, 0, Math.PI * 2) }
        }
        g.globalAlpha = 0.85
        for (const [c, path] of small) { g.fillStyle = c; g.fill(path) }
        g.globalAlpha = 1
        for (const [c, path] of big) { g.fillStyle = c; g.fill(path) }
        g.strokeStyle = ring; g.lineWidth = 1; g.stroke(rings)
        g.strokeStyle = gold; g.lineWidth = 1.5; g.stroke(owned)
      }
      // Labels go on top of the crowd, each with a knock-out halo so it
      // reads on land, sea, coast or people alike.
      const label = (t: string, x: number, y: number, fill: string, halo: string) => {
        g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = halo; g.strokeText(t, x, y)
        g.fillStyle = fill; g.fillText(t, x, y)
      }
      // Place names, biggest first, each tried right, left, above and below,
      // and dropped if it would cover a name already drawn. Zooming in makes room.
      named.sort((a, b) => Number(b.city) - Number(a.city) || Number(a.p.kind === 'ship') - Number(b.p.kind === 'ship') || b.p.pop - a.p.pop)
      g.textBaseline = 'middle'
      const drawn = new Set<string>()
      for (const { p, px, py, city } of named) {
        g.font = city ? '600 11px Inter, system-ui, sans-serif' : 'italic 500 10px Inter, system-ui, sans-serif'
        const tw = g.measureText(p.name).width, th = city ? 13 : 12
        const tries: [number, number, CanvasTextAlign][] = [[px + 6, py, 'left'], [px - 6, py, 'right'], [px, py - 10, 'center'], [px, py + 11, 'center']]
        for (const [tx, ty, al] of tries) {
          const x0 = al === 'left' ? tx : al === 'right' ? tx - tw : tx - tw / 2
          const b: [number, number, number, number] = [x0 - 1, ty - th / 2, x0 + tw + 1, ty + th / 2]
          if (!free(b)) continue
          boxes.push(b)
          g.textAlign = al
          label(p.name, tx, ty, city ? text : region, land)
          drawn.add(p.name.toLowerCase())
          break
        }
      }
      // Nation and sea names fill whatever room is left.
      g.textAlign = 'center'
      for (const lb of REGION_LABELS) {
        if (drawn.has(lb.n.toLowerCase())) continue
        const t = lb.sea ? lb.n : lb.n.toUpperCase()
        g.font = lb.sea ? `italic 500 ${Math.max(10, Math.min(13, s))}px Inter, system-ui, sans-serif` : `600 ${Math.max(9, Math.min(12, s * 0.85))}px Inter, system-ui, sans-serif`
        const tw = g.measureText(t).width, x = X(lb.x), y = Y(lb.y)
        const b: [number, number, number, number] = [x - tw / 2 - 2, y - 7, x + tw / 2 + 2, y + 7]
        if (!free(b)) continue
        boxes.push(b)
        label(t, x, y, lb.sea ? seaText : region, lb.sea ? water : land)
      }
      g.font = 'italic 600 10px Inter, system-ui, sans-serif'
      for (const bn of beyondNames) label(bn.t, bn.px, bn.py, gold, water)
      // The person you follow: a glow in their Nen colour, a ringed bead and a name tag.
      if (me) {
        const px = X(me.x), py = Y(me.y)
        const R = 15 + (calm ? 0 : Math.sin(anim.current / 14) * 3)
        const gr = g.createRadialGradient(px, py, 4, px, py, R)
        gr.addColorStop(0, me.c + '99'); gr.addColorStop(1, me.c + '00')
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, R, 0, Math.PI * 2); g.fill()
        g.fillStyle = card; g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill()
        g.strokeStyle = fg; g.lineWidth = 2; g.stroke()
        g.fillStyle = me.c; g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.fill()
        const nm = frame?.names.p[me.id]?.n
        if (nm) {
          g.font = '600 11px Inter, system-ui, sans-serif'
          const w = g.measureText(nm).width + 14
          const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, px))
          g.fillStyle = fg; g.beginPath(); g.roundRect(x - w / 2, py - 30, w, 18, 9); g.fill()
          g.fillStyle = bg; g.textAlign = 'center'; g.fillText(nm, x, py - 21)
        }
      }
      g.textBaseline = 'alphabetic'
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
          setTip(best?.n ? { x: p.lx + 12, y: p.ly + 12, t: best.n } : null)
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
        {[['Enhancer', 'var(--enh)'], ['Transmuter', 'var(--tra)'], ['Conjurer', 'var(--con)'], ['Specialist', 'var(--spe)'], ['Manipulator', 'var(--man)'], ['Emitter', 'var(--emi)'], ['No Nen', '#94a3b8'], ['Chimera Ant', '#b91c1c']].map(([n, c]) => (
          <span key={n}><i className="dot" style={{ background: c }} />{n}</span>
        ))}
      </div>
    </div>
  )
}
