import type { StudentExamListItem } from '@exam/contracts'
import { importHmacKeyBase64 } from '@exam/integrity'
import { deletePackage, listPackages, savePackage } from '@/modules/offline'
import { fetchPackage } from './api'

/** Packages are offered from a day before a sitting opens (the server's PRELOAD_BEFORE_MS). */
const PRELOAD_BEFORE_MS = 24 * 3_600_000

/**
 * Keeps this device ready to start the student's sittings without network: downloads the package of each
 * sitting opening within a day when it is missing or outdated (an edit changes its version), and forgets
 * packages no longer needed. Failures are quiet: the exam still starts online.
 * Returns the ids of the exams ready to start offline.
 */
export async function preloadPackages(
  userId: string,
  exams: StudentExamListItem[],
  now = Date.now(),
): Promise<Set<string>> {
  const wanted = exams.filter(
    (e) => e.offline && !e.attempt && now >= e.opensAt - PRELOAD_BEFORE_MS && now < e.closesAt,
  )
  const stored = new Map((await listPackages(userId)).map((p) => [p.examId, p]))
  for (const examId of stored.keys())
    if (!wanted.some((e) => e.id === examId)) await deletePackage(userId, examId)
  const fresh = new Set<string>()
  for (const exam of wanted) {
    // Downloads happen only before opening; after that a current package is simply kept.
    if (now >= exam.opensAt || stored.get(exam.id)?.version === exam.offline?.version) continue
    const pkg = await fetchPackage(exam.id).catch(() => null)
    if (!pkg) continue
    const { hmacKey, ...rest } = pkg
    fresh.add(exam.id)
    await savePackage({
      ...rest,
      userId,
      key: await importHmacKeyBase64(hmacKey),
      clockOffset: pkg.serverTime - Date.now(),
    })
  }
  // Only current packages count as ready: an edit after opening changes the code, and an old package
  // would only answer "wrong code".
  // A package downloaded just now is current even if the list was read before its code existed.
  const current = (p: { examId: string; version: string }) =>
    fresh.has(p.examId) || wanted.find((e) => e.id === p.examId)?.offline?.version === p.version
  return new Set((await listPackages(userId)).filter(current).map((p) => p.examId))
}
