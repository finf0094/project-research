import type { StudentExamListItem } from '@exam/contracts'
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { useAuthStore } from '@/modules/auth'
import { listPackages } from '@/modules/offline'
import { isNetworkError } from '@/shared/lib/http'
import { useStored } from '@/shared/lib/stored'
import { useAction } from '@/shared/lib/use-action'
import { listExams } from './api'
import { preloadPackages } from './preload'

/**
 * The student's exams, sorted into what is open now, what comes next and what is done (home and results
 * tabs share it). The last list is kept on the device: with no network the student still finds the exam
 * and starts it from its downloaded package. `ready`: exams that can start without network here.
 */
export function useStudentExams() {
  const auth = useAuthStore()
  const load = useAction()
  const now = ref(Date.now())
  const clock = setInterval(() => (now.value = Date.now()), 1000)
  onScopeDispose(() => clearInterval(clock))
  // The routes require a signed-in student; a session ending meanwhile leads to sign-in (main.ts).
  const userId = auth.user?.id ?? ''
  const cached = useStored<StudentExamListItem[] | null>(`exams:list:${userId}`, null)
  // The last list shows at once (switching between Home and Results never flashes empty); the fresh one
  // replaces it when it comes.
  const exams = ref<StudentExamListItem[] | null>(cached.value)
  const fromCache = ref(false)
  const ready = ref(new Set<string>())
  const refresh = () =>
    load.run(async () => {
      try {
        exams.value = await listExams()
        cached.value = exams.value
        fromCache.value = false
        ready.value = await preloadPackages(userId, exams.value)
      } catch (error) {
        if (!isNetworkError(error) || !cached.value) throw error
        exams.value = cached.value
        fromCache.value = true
        ready.value = new Set((await listPackages(userId)).map((p) => p.examId))
      }
    })
  onMounted(refresh)

  const running = (e: StudentExamListItem) =>
    !!e.attempt && ['active', 'terminated'].includes(e.attempt.status)
  const all = computed(() => exams.value ?? [])
  const open = computed(() =>
    all.value.filter((e) => running(e) || (!e.attempt && e.opensAt <= now.value && now.value < e.closesAt)),
  )
  const upcoming = computed(() => all.value.filter((e) => !e.attempt && now.value < e.opensAt))
  const finished = computed(() =>
    all.value.filter((e) => (e.attempt && !running(e)) || (!e.attempt && now.value >= e.closesAt)),
  )
  return { exams, load, now, fromCache, ready, refresh, open, upcoming, finished }
}
