import type { StudentExamListItem } from '@exam/contracts'
import { deletePackage, listPackageIds, savePackage } from '@/modules/offline'
import { fetchPackage } from './api'

/** Packages are offered from a day before the exam opens (the server's PRELOAD_BEFORE_MS). */
const PRELOAD_BEFORE_MS = 24 * 3_600_000

/**
 * Keeps this device ready to start written exams without network: downloads the package of every exam that
 * opens within a day and has no attempt yet, fresh on every visit (an edited exam changes its code), and
 * forgets packages that are no longer needed. Failures are quiet: the exam still starts online.
 * Returns the ids of the exams ready to start offline.
 */
export async function preloadPackages(exams: StudentExamListItem[], now = Date.now()): Promise<Set<string>> {
  const wanted = exams.filter(
    (e) => e.mode === 'written' && !e.attempt && now >= e.opensAt - PRELOAD_BEFORE_MS && now < e.closesAt,
  )
  for (const id of await listPackageIds()) if (!wanted.some((e) => e.id === id)) await deletePackage(id)
  await Promise.all(
    wanted.map(async (e) => {
      const pkg = await fetchPackage(e.id).catch(() => null)
      if (pkg) await savePackage({ ...pkg, clockOffset: pkg.serverTime - Date.now() })
    }),
  )
  return new Set(await listPackageIds())
}
