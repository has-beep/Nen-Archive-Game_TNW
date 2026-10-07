/**
 * When the game is embedded in the Nen Archive (an iframe on /world), the
 * site tells it who is playing: their Patreon tier, and optionally an
 * Original Character with a Ledger ability to bring in. Messages from any
 * other origin are ignored.
 *
 *   iframe.contentWindow.postMessage({ type: 'nen-world:tier', tier: 'coffee' }, gameOrigin)
 *   iframe.contentWindow.postMessage({ type: 'nen-world:oc', oc, ability }, gameOrigin)
 */
import type { ArchiveAbility, ArchiveOC } from '../integration/archive-adapter'
import { client } from './client'

const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)*nenarchive\.(com|net|org|app)$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/]

export function listenToHost(onChange: (msg: string) => void) {
  const handler = async (e: MessageEvent) => {
    if (!ALLOWED.some((re) => re.test(e.origin))) return
    const d = e.data as { type?: string; tier?: string; oc?: ArchiveOC; ability?: ArchiveAbility }
    if (d?.type === 'nen-world:tier' && (d.tier === 'free' || d.tier === 'supporter' || d.tier === 'coffee')) {
      await client.call({ k: 'tier', tier: d.tier })
      onChange(`Playing on the ${d.tier} tier.`)
    }
    if (d?.type === 'nen-world:oc' && d.oc) {
      const r = await client.call<{ ok: boolean; msg: string }>({ k: 'importOC', oc: d.oc, ability: d.ability })
      onChange(r.msg)
    }
  }
  window.addEventListener('message', handler)
  // Tell the host we are ready for it.
  if (window.parent !== window) window.parent.postMessage({ type: 'nen-world:ready' }, '*')
  return () => window.removeEventListener('message', handler)
}
