/**
 * Typed text becomes a sealed event after a short pause, not on every keystroke.
 * `flush` saves whatever is still waiting (blur, page hide, finishing).
 */
export function createTextDrafts(save: (questionId: string) => Promise<void>, delayMs = 800) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const take = () => {
    const ids = [...timers.keys()]
    timers.forEach(clearTimeout)
    timers.clear()
    return ids
  }
  return {
    schedule(questionId: string) {
      clearTimeout(timers.get(questionId))
      timers.set(
        questionId,
        setTimeout(() => {
          timers.delete(questionId)
          void save(questionId)
        }, delayMs),
      )
    },
    cancel(questionId: string) {
      clearTimeout(timers.get(questionId))
      timers.delete(questionId)
    },
    flush: () => Promise.all(take().map(save)).then(() => undefined),
    discard: () => void take(),
  }
}
