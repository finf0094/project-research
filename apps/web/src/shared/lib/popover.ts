const GAP = 8
const EDGE = 8

/**
 * Places a native popover next to the button that opens it, where it fits: below (or above when the
 * button is near the bottom, as in the staff sidebar), right edges aligned but kept inside the window.
 * Popovers live in the top layer and CSS anchor positioning is not yet in every target browser, so this
 * runs on the `toggle` event, when the menu can be measured.
 */
export function placeNextToOpener(event: Event) {
  const menu = event.target as HTMLElement
  // While open it follows its button when the window changes (a rotation, the phone's address bar).
  if ((event as ToggleEvent).newState !== 'open') return
  const follow = () => place(menu)
  place(menu)
  addEventListener('resize', follow)
  // The next toggle is the close: the listener goes with it.
  menu.addEventListener('toggle', () => removeEventListener('resize', follow), { once: true })
}

function place(menu: HTMLElement) {
  const opener = document.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`)
  if (!opener) return
  const button = opener.getBoundingClientRect()
  const { width, height } = menu.getBoundingClientRect()
  const below = button.bottom + GAP
  const top = below + height > innerHeight - EDGE ? button.top - GAP - height : below
  const left = Math.min(Math.max(EDGE, button.right - width), innerWidth - width - EDGE)
  menu.style.top = `${Math.max(EDGE, top)}px`
  menu.style.left = `${left}px`
}
