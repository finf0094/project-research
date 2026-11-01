import type { SignalKind } from '@exam/contracts'
import { watchDevices, watchMicrophone } from './devices'
import type { SetSignal } from './signals'

/** The page may lose focus this long (the browser's own menus, a permission prompt) before it counts. */
const BLUR_GRACE_MS = 2000

/** Browser signals: leaving the tab, pasting or copying text, a second screen. Returns a stop function. */
export function watchBrowser(setSignal: SetSignal) {
  // Away from the exam: its tab hidden, or another window or app in front while the tab stays visible.
  // `document.hasFocus()` is asked only after a blur: on iPhone it can still read false after the student
  // came back (the `focus` event may come late or never), which would keep a false "tab hidden" on.
  let unfocused = false
  const away = () => setSignal('tab_hidden', document.visibilityState === 'hidden' || unfocused)
  // Clicking the browser's own controls blurs the page for a moment; only staying away counts.
  let blurred: ReturnType<typeof setTimeout> | undefined
  const stillBlurred = () => ((unfocused = !document.hasFocus()), away())
  const onBlur = () => (clearTimeout(blurred), (blurred = setTimeout(stillBlurred, BLUR_GRACE_MS)))
  const back = () => (clearTimeout(blurred), (unfocused = false), away())
  // The page shown again means the student is back, whatever the focus says.
  const onVisibility = () => (document.visibilityState === 'visible' ? back() : away())
  // Only substantial text matters; moving a word around is normal editing.
  const substantial = (text: string | undefined) => (text ?? '').trim().length >= 20
  const pulse = (kind: SignalKind) => (setSignal(kind, true), setSignal(kind, false))
  const onPaste = (event: ClipboardEvent) =>
    substantial(event.clipboardData?.getData('text')) && pulse('paste')
  // Copying from the exam's text, not the student's own answer (an input or a text area).
  const onCopy = (event: ClipboardEvent) =>
    !(event.target as Element | null)?.closest?.('input, textarea, [contenteditable]') &&
    substantial(document.getSelection()?.toString()) &&
    pulse('copy')
  // A second screen (Chromium tells; elsewhere this stays unknown and silent).
  // Safari's `screen` is no event target at all (calling addEventListener on it throws): checked first.
  const display = screen as unknown as Partial<EventTarget> & { isExtended?: boolean }
  const onScreen = () => display.isExtended !== undefined && setSignal('second_screen', display.isExtended)
  onScreen()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', back)
  document.addEventListener('paste', onPaste)
  document.addEventListener('copy', onCopy)
  display.addEventListener?.('change', onScreen)
  return () => {
    clearTimeout(blurred)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', back)
    document.removeEventListener('paste', onPaste)
    document.removeEventListener('copy', onCopy)
    display.removeEventListener?.('change', onScreen)
  }
}

/**
 * Starts every watcher of the browser and the devices in use. One a browser cannot run (a missing API, as on
 * Safari) is skipped, so one missing browser feature never turns the camera off. Returns a function that
 * stops them all.
 */
export function watchAll(stream: MediaStream, setSignal: SetSignal): () => void {
  const starts = [
    () => watchBrowser(setSignal),
    () => watchMicrophone(stream, setSignal),
    () => watchDevices(stream, setSignal),
  ]
  const stops = starts.map((start) => {
    try {
      return start()
    } catch (error) {
      console.error('a proctoring watcher cannot run in this browser', error)
      return () => undefined
    }
  })
  return () => stops.forEach((stop) => stop())
}
