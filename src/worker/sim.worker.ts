/// <reference lib="webworker" />
/**
 * The simulation's own thread. The page sends requests; the world never
 * leaves this worker except as views and save files.
 */
import { Engine, type Request } from '../sim/api/engine'

const engine = new Engine()
self.onmessage = (m: MessageEvent<{ id: number; req: Request }>) => {
  const { id, req } = m.data
  try {
    const res = engine.handle(req)
    ;(self as unknown as Worker).postMessage({ id, res })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, err: err instanceof Error ? `${err.message}\n${err.stack}` : String(err) })
  }
}
