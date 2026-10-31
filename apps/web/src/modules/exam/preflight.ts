export interface Check {
  id: 'browser' | 'storage' | 'persist'
  ok: boolean
  /** Whether the student should read the advice for this check. */
  advise: boolean
}

/**
 * Browser checks that do not need a camera. The exam must not start on a browser that
 * cannot keep answers offline, because that is exactly what protects the student.
 */
export async function runBrowserChecks(): Promise<Check[]> {
  const supported = 'indexedDB' in window && !!crypto.subtle && 'locks' in navigator
  // Asks the browser not to evict our data under storage pressure (answers live there until delivered).
  const persisted = (await navigator.storage?.persist?.().catch(() => false)) ?? false
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
  const freeMb =
    estimate?.quota && estimate.usage !== undefined ? (estimate.quota - estimate.usage) / 1_048_576 : null
  const enoughSpace = freeMb === null || freeMb > 200
  return [
    { id: 'browser', ok: supported, advise: !supported },
    { id: 'storage', ok: enoughSpace, advise: !enoughSpace },
    // Not every browser grants persistence; the exam still works, so this is informational.
    { id: 'persist', ok: true, advise: !persisted },
  ]
}
