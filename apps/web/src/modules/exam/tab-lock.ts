/**
 * Holds a Web Lock while the attempt is open, so the same attempt cannot run in two tabs
 * (two tabs would fork the hash chain). Resolves to a release function, or null if another tab holds it.
 */
export async function acquireTabLock(name: string): Promise<(() => void) | null> {
  // The same tab leaving and coming straight back may still hold it for the last save: wait briefly.
  for (let tries = 0; tries < 10; tries++) {
    const release = await tryLock(name)
    if (release) return release
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return null
}

function tryLock(name: string): Promise<(() => void) | null> {
  if (!navigator.locks) return Promise.resolve(() => undefined)
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
