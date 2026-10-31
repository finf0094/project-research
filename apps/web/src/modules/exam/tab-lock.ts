/**
 * Holds a Web Lock while the attempt is open, so the same attempt cannot run in two tabs
 * (two tabs would fork the hash chain). Resolves to a release function, or null if another tab holds it.
 */
export function acquireTabLock(name: string): Promise<(() => void) | null> {
  if (!('locks' in navigator)) return Promise.resolve(() => undefined)
  return new Promise((resolve) => {
    void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null)
        return
      }
      return new Promise<void>((release) => resolve(() => release()))
    })
  })
}
