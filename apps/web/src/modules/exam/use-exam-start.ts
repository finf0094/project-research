import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { deletePackage, getPackage, type LocalAttempt, type StoredPackage } from '@/modules/offline'
import { isNetworkError } from '@/shared/lib/http'
import { useAction } from '@/shared/lib/use-action'
import { beginAttempt } from './local-attempt'
import { NotOpen, WrongStartCode, startOffline } from './offline-start'
import { attemptPath } from './paths'

/**
 * Starting an exam from the preflight page: online as usual; when the network is gone and this device holds
 * the exam's package, `offline` turns on and the attempt begins with the start code the proctor announces.
 */
export function useExamStart(examId: string, userId: string) {
  const router = useRouter()
  const starting = useAction({ 409: 'exam.preflight.notOpen' as const })
  const unlocking = ref(false)
  const codeError = ref<'exam.offlineStart.wrongCode' | 'exam.preflight.notOpen' | null>(null)
  const pkg = ref<StoredPackage | null>(null)
  const offline = ref(false)
  onMounted(async () => (pkg.value = (await getPackage(userId, examId)) ?? null))

  const open = (attempt: LocalAttempt) => router.replace(attemptPath(attempt.id, attempt.exam.profile.mode))

  const start = () =>
    starting.run(async () => {
      try {
        const attempt = await beginAttempt(examId)
        // Started online: the package (and its key) is not needed on this device any more.
        if (pkg.value) await deletePackage(userId, examId)
        await open(attempt)
      } catch (error) {
        if (!isNetworkError(error) || !pkg.value) throw error
        offline.value = true
      }
    })

  async function startWithCode(code: string) {
    if (!pkg.value || unlocking.value) return
    unlocking.value = true
    codeError.value = null
    try {
      await open(await startOffline(pkg.value, code))
    } catch (error) {
      if (error instanceof WrongStartCode) codeError.value = 'exam.offlineStart.wrongCode'
      else if (error instanceof NotOpen) codeError.value = 'exam.preflight.notOpen'
      else throw error
    } finally {
      unlocking.value = false
    }
  }

  return { starting, start, pkg, offline, unlocking, codeError, startWithCode }
}
