import type { AttemptDetail, DecisionBody, UpdateMarkerBody } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { chunkUrl, decide, getAttempt, judgeMarker, listAttempts } from './api'
import { queuePlace, type QueuePlace } from './review-queue'

/**
 * One attempt under review: its data (only the newest load applies), the marker on stage, judging markers
 * and saving the decision, and its place in the exam's queue.
 */
export function useAttemptReview(attemptId: string) {
  const detail = ref<AttemptDetail | null>(null)
  const selected = ref<string | null>(null)
  const saved = ref(false)
  const action = useAction()
  /** Saving has its own state: judging markers must not spin the save button. */
  const saving = useAction()

  /** Only the newest load is applied: judging and saving both reload, and answers may arrive out of order. */
  let loads = 0
  async function load() {
    const mine = ++loads
    const fresh = await getAttempt(attemptId)
    if (mine !== loads) return
    detail.value = fresh
    // A re-analysis replaces markers: a selection that no longer exists moves to the next one to look at.
    if (!fresh.markers.some((m) => m.id === selected.value)) selected.value = nextPending(fresh)
  }

  // The queue is a convenience: without it the page still works, just without "next".
  const queue = ref<QueuePlace | null>(null)
  const loadQueue = (examId: string) =>
    listAttempts(examId)
      .then((list) => (queue.value = queuePlace(list, attemptId)))
      .catch(() => {})

  onMounted(async () => {
    await action.run(load)
    if (detail.value) void loadQueue(detail.value.examId)
  })

  const marker = computed(() => detail.value?.markers.find((m) => m.id === selected.value) ?? null)
  const sources = computed(() => (marker.value?.chunks ?? []).map((hash) => chunkUrl(attemptId, hash)))
  const audioUrl = computed(() =>
    detail.value?.audio?.hash ? chunkUrl(attemptId, detail.value.audio.hash) : null,
  )
  const end = computed(() => detail.value?.submittedAt ?? detail.value?.summary.lastSeenAt ?? 0)
  /** Oral exams and free-text answers have no automatic total: the examiner gives the score. */
  const needsScore = computed(
    () => detail.value?.examMode === 'oral' || !!detail.value?.answers.some((a) => a.autoScore === null),
  )
  const editable = computed(() =>
    ['ready_for_review', 'decided'].includes(detail.value?.summary.status ?? ''),
  )

  const nextPending = (d: AttemptDetail) =>
    (d.markers.find((m) => m.status === 'pending') ?? d.markers[0])?.id ?? null

  /** Judging the marker on stage moves the stage on to the next one still to look at. */
  const judge = (id: string, status: UpdateMarkerBody['status']) =>
    action.run(async () => {
      saving.error.value = null // only the latest failure is shown
      await judgeMarker(id, status)
      await load()
      if (status !== 'pending' && selected.value === id && detail.value)
        selected.value = nextPending(detail.value)
    })

  async function save(body: DecisionBody) {
    saved.value = false
    action.error.value = null // only the latest failure is shown
    await saving.run(async () => {
      await decide(attemptId, body)
      saved.value = true // saved even if the reload below fails
      await load()
      if (detail.value) void loadQueue(detail.value.examId)
    })
  }

  return {
    detail,
    selected,
    saved,
    action,
    saving,
    queue,
    marker,
    sources,
    audioUrl,
    end,
    needsScore,
    editable,
    judge,
    save,
  }
}
