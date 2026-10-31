/**
 * Places a native popover under the button that opens it (right edges aligned). Popovers live in the top
 * layer, and CSS anchor positioning is not yet in every target browser, so this runs on `beforetoggle`.
 */
export function placeUnderOpener(event: Event) {
  if ((event as ToggleEvent).newState !== 'open') return
  const menu = event.target as HTMLElement
  const opener = document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`)
  if (!opener) return
  const rect = opener.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 8}px`
  menu.style.right = `${document.documentElement.clientWidth - rect.right}px`
}
