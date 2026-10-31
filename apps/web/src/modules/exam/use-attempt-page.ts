import type { ExamMode } from '@exam/contracts'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useExamStore } from './exam.store'
import { attemptPath } from './paths'

/**
 * What both exam pages (written and oral) do around their content: open the attempt from the URL, go to
 * the page of its mode if this is the wrong one, move on to "done" once it is locked, close it on leave.
 */
export function useAttemptPage(mode: ExamMode) {
  const route = useRoute()
  const router = useRouter()
  const exam = useExamStore()
  const attemptId = computed(() => String(route.params.attemptId))
  const loadError = ref(false)
  const confirming = ref(false)

  async function open(id: string) {
    loadError.value = false
    try {
      await exam.open(id)
    } catch {
      loadError.value = true
      return
    }
    // Only for an attempt this device had never seen: the route guard could not know its mode yet.
    const actual = exam.attempt?.exam.profile.mode
    if (actual && actual !== mode)
      await router.replace({ path: attemptPath(id, actual), query: route.query, hash: route.hash })
  }
  watch(attemptId, open, { immediate: true })

  // Leaving for the "done" page keeps the session running: it still has to deliver answers and recordings.
  watch(
    () => exam.locked,
    (locked) => locked && router.replace(`/attempts/${attemptId.value}/done`),
  )
  onUnmounted(() => {
    if (!exam.locked) exam.close()
  })

  function finish() {
    confirming.value = false
    void exam.finish()
  }

  return { exam, attemptId, loadError, confirming, open, finish }
}
