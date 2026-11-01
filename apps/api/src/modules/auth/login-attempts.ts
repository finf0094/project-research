/**
 * Sign-in attempts per address and account, kept in this process: after `max` in a minute that pair waits.
 * An attempt counts from its start (so a burst sent at once is limited too) and a success clears the pair.
 * Mostly that address is limited, so a classmate elsewhere cannot easily lock a student out; across all
 * addresses an account gets ten times as many, which still bounds guessing from many addresses. Case
 * spellings of one email count as one account.
 */
export function loginAttempts(now: () => number, max = 10, windowMs = 60_000, maxKeys = 10_000) {
  const accountMax = max * 10
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
      const pair = keyOf(ip, email)
      const account = keyOf('*', email)
      if (recent(pair).length >= max || recent(account).length >= accountMax) return false
      for (const key of [pair, account]) {
        const times = recent(key)
        attempts.delete(key) // re-inserted last: the map stays in order of use, oldest first
        attempts.set(key, [...times, now()])
      }
      trim()
      return true
    },
    succeeded(ip: string, email: string) {
      attempts.delete(keyOf(ip, email))
      attempts.delete(keyOf('*', email))
    },
  }
}
