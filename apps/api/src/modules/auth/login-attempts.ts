/**
 * Sign-in attempts per address and account, kept in this process: after `max` in a minute that pair waits.
 * An attempt counts from its start (so a burst sent at once is limited too) and a success clears the pair.
 * Only that address is limited, so a classmate elsewhere cannot lock a student out; trying many case
 * spellings of one email counts as one account.
 */
export function loginAttempts(now: () => number, max = 10, windowMs = 60_000, maxKeys = 10_000) {
  const attempts = new Map<string, number[]>()
  const keyOf = (ip: string, email: string) => `${ip}|${email.toLowerCase()}`
  const recent = (key: string) => (attempts.get(key) ?? []).filter((t) => now() - t < windowMs)

  /** Bounded memory: past the limit the oldest pairs go (a spray is held back by the per-address limit). */
  function trim() {
    if (attempts.size < maxKeys) return
    for (const key of [...attempts.keys()].slice(0, Math.ceil(maxKeys / 2))) attempts.delete(key)
  }

  return {
    /** False when this pair must wait; otherwise the attempt is counted. */
    begin(ip: string, email: string) {
      const key = keyOf(ip, email)
      const times = recent(key)
      if (times.length >= max) return false
      attempts.delete(key) // re-inserted last: the map stays in order of use, oldest first
      attempts.set(key, [...times, now()])
      trim()
      return true
    },
    succeeded: (ip: string, email: string) => void attempts.delete(keyOf(ip, email)),
  }
}
