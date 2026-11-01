/**
 * Failed sign-ins per address and account, kept in this process: after `max` failures in a minute that pair
 * waits. Only failures count, and only from that address, so a classmate elsewhere cannot lock a student
 * out; trying many case spellings of one email counts as one account.
 */
export function failedLogins(now: () => number, max = 10, windowMs = 60_000) {
  const failures = new Map<string, number[]>()
  const keyOf = (ip: string, email: string) => `${ip}|${email.toLowerCase()}`
  const recent = (key: string) => (failures.get(key) ?? []).filter((t) => now() - t < windowMs)

  return {
    blocked: (ip: string, email: string) => recent(keyOf(ip, email)).length >= max,
    record(ip: string, email: string) {
      // Bounded: stale entries are dropped once the map grows (a spray over many emails cannot fill memory).
      if (failures.size > 10_000)
        for (const key of failures.keys()) if (!recent(key).length) failures.delete(key)
      const key = keyOf(ip, email)
      failures.set(key, [...recent(key), now()])
    },
  }
}
