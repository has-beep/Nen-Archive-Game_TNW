/**
 * The engine facade: one object that owns a world and answers every request
 * the interface can make. It runs inside a Web Worker when it can, and on
 * the main thread when the page does not allow workers; either way the
 * interface talks to it with the same messages.
 */
import { createWorld, type WorldOptions } from '../worldgen/worldgen'
import { tick } from '../tick'
import type { HatsuSpec, Id, World } from '../types'
import * as V from './views'
import { choose, fate, forge, FATE_COST } from '../player/player'
import { createCharacter, own, release, type CharacterSpec } from '../player/create'
import { reindex } from '../world'

export type Request =
  | { k: 'new'; opts: WorldOptions }
  | { k: 'load'; json: string }
  | { k: 'save' }
  | { k: 'step'; days: number }
  | { k: 'view'; view: 'person' | 'place' | 'nation' | 'org' | 'event' | 'chronicle' | 'world' | 'beyond' | 'legends' | 'search' | 'cast' | 'player' | 'places'; id?: Id; q?: string; opts?: Record<string, unknown> }
  | { k: 'follow'; id: Id }
  | { k: 'own'; id: Id }
  | { k: 'release'; id: Id }
  | { k: 'choose'; id: Id; option: string }
  | { k: 'fate'; fate: keyof typeof FATE_COST; args: Record<string, number | string> }
  | { k: 'forge'; pid: Id; spec: HatsuSpec }
  | { k: 'create'; spec: CharacterSpec }
  | { k: 'tier'; tier: 'free' | 'supporter' | 'coffee' }
  | { k: 'frame'; minImp?: number }

export class Engine {
  w: World | null = null
  private fresh: Id[] = []

  handle(req: Request): unknown {
    switch (req.k) {
      case 'new': this.w = createWorld(req.opts); this.fresh = this.w.events.map((e) => e.id); return { ok: true, seed: this.w.seed }
      case 'load': this.w = JSON.parse(req.json) as World; reindex(this.w); this.fresh = []; return { ok: true, seed: this.w.seed }
      case 'save': return this.w ? JSON.stringify(this.w) : null
    }
    const w = this.w
    if (!w) return { ok: false, msg: 'No world.' }
    switch (req.k) {
      case 'step': {
        const n = Math.max(1, Math.min(366, req.days | 0))
        for (let i = 0; i < n; i++) {
          const f = tick(w)
          for (const id of f) this.fresh.push(id)
          // Stop early when the player has a decision to make.
          if (w.player.crossroads.some((c) => !c.chosen && c.t === w.t) && w.player.settings.pause) break
        }
        return { ok: true, t: w.t }
      }
      case 'frame': { const fr = V.frame(w, this.fresh, req.minImp ?? 3); this.fresh = []; return fr }
      case 'follow': if (w.people[req.id]) w.player.follow = req.id; return { ok: true }
      case 'own': return own(w, req.id)
      case 'release': return release(w, req.id)
      case 'choose': return choose(w, req.id, req.option)
      case 'fate': return fate(w, req.fate, req.args)
      case 'forge': return forge(w, req.pid, req.spec)
      case 'create': return createCharacter(w, req.spec)
      case 'tier': w.player.tier = req.tier; return { ok: true }
      case 'view':
        switch (req.view) {
          case 'person': return V.personView(w, req.id!)
          case 'place': return V.placeView(w, req.id!)
          case 'nation': return V.nationView(w, req.id!)
          case 'org': return V.orgView(w, req.id!)
          case 'event': return V.eventView(w, req.id!)
          case 'chronicle': return V.chronicleView(w, (req.opts || {}) as Parameters<typeof V.chronicleView>[1])
          case 'world': return V.worldView(w)
          case 'beyond': return V.beyondView(w)
          case 'legends': return V.legendsView(w)
          case 'search': return V.searchView(w, req.q || '')
          case 'cast': return V.castView(w)
          case 'player': return V.playerView(w)
          case 'places': return V.placesView(w)
        }
    }
    return null
  }
}
