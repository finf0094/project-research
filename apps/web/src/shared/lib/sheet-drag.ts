import { onScopeDispose, watch, type Ref } from 'vue'

/** Dragged down past this share of its height, or flicked faster than this (px per ms), the sheet closes. */
const DISMISS_SHARE = 0.25
const DISMISS_SPEED = 0.6
/** A drag starts only from the sheet's top (the grabber and the title) or while its content is scrolled up. */
const HANDLE_PX = 56

export function shouldDismiss(dragged: number, height: number, speed: number) {
  return dragged > height * DISMISS_SHARE || speed > DISMISS_SPEED
}

/**
 * A bottom sheet follows the finger down and closes past a threshold, as in a native app; let go earlier it
 * springs back. Phones only (the sheet layout of AppDialog), by touch. Its `close` event (a <dialog>) ends a drag.
 */
export function useSheetDrag(sheet: Ref<HTMLElement | undefined>, dismiss: () => void) {
  const phone = matchMedia('(width < 700px)')
  let start: { y: number; t: number } | null = null
  let dragged = 0

  /** Back in place with no drag going on (also when the dialog closes in the middle of one). */
  function reset() {
    start = null
    const el = sheet.value
    el?.removeEventListener('transitionend', slidOut)
    if (el) el.style.transition = el.style.translate = ''
  }
  /** The sheet has slid out of sight (not a transition of something inside it). */
  function slidOut(e: Event) {
    if (e.target !== sheet.value) return
    sheet.value?.removeEventListener('transitionend', slidOut)
    dismiss()
  }
  function down(e: TouchEvent) {
    const el = sheet.value
    const touch = e.touches[0]
    if (!el || !touch || !phone.matches) return
    if (e.touches.length > 1) return reset() // a second finger: not a swipe any more
    const fromTop = touch.clientY - el.getBoundingClientRect().top
    if (fromTop > HANDLE_PX && el.scrollTop > 0) return
    start = { y: touch.clientY, t: performance.now() }
    dragged = 0
  }
  function move(e: TouchEvent) {
    const el = sheet.value
    const touch = e.touches[0]
    if (!start || !el || !touch) return
    // The content scrolled first: the finger reads it, not the sheet, until it is let go.
    if (dragged === 0 && el.scrollTop > 0) return void (start = null)
    dragged = Math.max(0, touch.clientY - start.y)
    if (dragged === 0) return
    e.preventDefault() // the sheet moves, not the page or its own content
    el.style.transition = 'none'
    el.style.translate = `0 ${dragged}px`
  }
  function up() {
    const el = sheet.value
    if (!start || !el) return
    const speed = dragged / Math.max(1, performance.now() - start.t)
    start = null
    el.style.transition = 'translate var(--dur) var(--ease)'
    if (dragged > 0 && shouldDismiss(dragged, el.offsetHeight, speed)) {
      el.style.translate = '0 100%'
      el.addEventListener('transitionend', slidOut) // the dialog's close event puts it back in place
    } else {
      el.style.translate = ''
    }
  }

  // Not passive: a drag must be able to stop the page from scrolling under it.
  const events = [
    ['touchstart', down],
    ['touchmove', move],
    ['touchend', up],
    ['touchcancel', up],
    ['close', reset],
  ] as const
  const stop = watch(
    sheet,
    (el, old) => {
      for (const [type, fn] of events) old?.removeEventListener(type, fn as EventListener)
      for (const [type, fn] of events) el?.addEventListener(type, fn as EventListener, { passive: false })
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    stop()
    for (const [type, fn] of events) sheet.value?.removeEventListener(type, fn as EventListener)
  })
}
