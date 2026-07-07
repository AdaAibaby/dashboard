// Single-use in-memory store for the OAuth-to-session-cookie handoff.
// Lives only within the Node.js process; a container restart orphans any
// in-flight logins (TTL is 2 min, so this is acceptable).
const store = new Map<string, { jwe: string; expiresAt: number }>()

const TTL_MS = 120_000 // 2 minutes

function purge() {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k)
  }
}

export function storePendingJwe(jwe: string): string {
  purge()
  const id = globalThis.crypto.randomUUID()
  store.set(id, { jwe, expiresAt: Date.now() + TTL_MS })
  return id
}

export function consumePendingJwe(id: string): string | null {
  const entry = store.get(id)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(id)
    return null
  }
  store.delete(id)
  return entry.jwe
}
