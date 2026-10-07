/**
 * Talks to the engine. A Web Worker keeps the page smooth while years pass;
 * if the page cannot start one (some embeds forbid it), the same engine runs
 * here, in small slices, and the game still works.
 */
import type { Request } from '../sim/api/engine'
import SimWorker from '../worker/sim.worker?worker&inline'

type Pending = { res: (v: unknown) => void; rej: (e: Error) => void }

export class Client {
  private worker: Worker | null = null
  private local: { handle: (r: Request) => unknown } | null = null
  private seq = 0
  private pending = new Map<number, Pending>()
  mode: 'worker' | 'local' = 'worker'

  async start(): Promise<void> {
    try {
      const wk = new SimWorker()
      wk.onmessage = (m: MessageEvent<{ id: number; res?: unknown; err?: string }>) => {
        const p = this.pending.get(m.data.id)
        if (!p) return
        this.pending.delete(m.data.id)
        if (m.data.err) p.rej(new Error(m.data.err)); else p.res(m.data.res)
      }
      this.worker = wk
      const ok = await Promise.race([this.call({ k: 'frame' }).then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 2500))])
      if (ok) return
      wk.terminate()
      this.worker = null
    } catch {
      this.worker = null
    }
    const { Engine } = await import('../sim/api/engine')
    this.local = new Engine()
    this.mode = 'local'
  }

  call<T = unknown>(req: Request): Promise<T> {
    if (this.local) {
      const l = this.local
      return new Promise<T>((res, rej) => setTimeout(() => { try { res(l.handle(req) as T) } catch (e) { rej(e as Error) } }, 0))
    }
    const id = ++this.seq
    return new Promise<T>((res, rej) => {
      this.pending.set(id, { res: res as (v: unknown) => void, rej })
      this.worker!.postMessage({ id, req })
    })
  }
}

export const client = new Client()
