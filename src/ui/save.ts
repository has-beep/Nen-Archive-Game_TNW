/**
 * Saving a world in this browser: compressed, in IndexedDB. Everything is
 * wrapped so a browser that refuses storage just says so.
 */
const DB = 'nen-world'
const STORE = 'saves'

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function gzip(s: string): Promise<Blob | string> {
  if (typeof CompressionStream === 'undefined') return s
  const cs = new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))
  return await new Response(cs).blob()
}
async function gunzip(b: Blob | string): Promise<string> {
  if (typeof b === 'string') return b
  const ds = b.stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(ds).text()
}

export async function writeSave(json: string, slot = 'auto'): Promise<boolean> {
  try {
    const data = await gzip(json)
    const d = await db()
    await new Promise<void>((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(data, slot); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    return true
  } catch { return false }
}

export async function loadSave(slot = 'auto'): Promise<string | null> {
  try {
    const d = await db()
    const data = await new Promise<Blob | string | undefined>((res, rej) => { const tx = d.transaction(STORE, 'readonly'); const g = tx.objectStore(STORE).get(slot); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error) })
    return data ? await gunzip(data) : null
  } catch { return null }
}
