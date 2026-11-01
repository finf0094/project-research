import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { shouldDismiss, useSheetDrag } from './sheet-drag'

describe('dragging a bottom sheet', () => {
  it('closes past a quarter of its height or on a quick flick, and springs back otherwise', () => {
    expect(shouldDismiss(120, 400, 0.2)).toBe(true)
    expect(shouldDismiss(40, 400, 1)).toBe(true)
    expect(shouldDismiss(40, 400, 0.2)).toBe(false)
  })
})

describe('the sheet under the finger', () => {
  let el: HTMLElement
  let dismiss: ReturnType<typeof vi.fn<() => void>>
  let scope: ReturnType<typeof effectScope>
  const touch = (type: string, ...ys: number[]) => {
    const event = new Event(type, { cancelable: true })
    Object.defineProperty(event, 'touches', { value: ys.map((clientY) => ({ clientY })) })
    el.dispatchEvent(event)
  }
  const slideEnds = () => el.dispatchEvent(new Event('transitionend'))

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    el = document.createElement('div')
    Object.defineProperty(el, 'offsetHeight', { value: 400 })
    dismiss = vi.fn<() => void>()
    scope = effectScope()
    scope.run(() => useSheetDrag(ref(el), dismiss))
  })
  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
  })

  it('follows the finger and closes once it has slid away', () => {
    touch('touchstart', 10)
    touch('touchmove', 210)
    expect(el.style.translate).toBe('0 200px')
    touch('touchend')
    expect(el.style.translate).toBe('0 100%')
    expect(dismiss).not.toHaveBeenCalled()
    slideEnds()
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('springs back on a short slow drag, and a later transition does not close it', () => {
    touch('touchstart', 10)
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 1000)
    touch('touchmove', 40)
    touch('touchend')
    expect(el.style.translate).toBe('')
    slideEnds()
    expect(dismiss).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('opens in place again when the dialog closed in the middle of a drag (Esc)', () => {
    touch('touchstart', 10)
    touch('touchmove', 210)
    el.dispatchEvent(new Event('close'))
    touch('touchend')
    expect(el.style.translate).toBe('')
    expect(el.style.transition).toBe('')
  })

  it('a closed sheet that was sliding away is reset and its pending slide does not close it again', () => {
    touch('touchstart', 10)
    touch('touchmove', 210)
    touch('touchend')
    el.dispatchEvent(new Event('close'))
    expect(el.style.translate).toBe('')
    slideEnds()
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('lets go on a second finger', () => {
    touch('touchstart', 10)
    touch('touchmove', 110)
    touch('touchstart', 110, 300)
    expect(el.style.translate).toBe('')
    touch('touchend')
    expect(dismiss).not.toHaveBeenCalled()
    expect(el.style.translate).toBe('')
  })

  it('leaves scrolled content to the finger', () => {
    el.scrollTop = 50
    touch('touchstart', 200)
    touch('touchmove', 400)
    expect(el.style.translate).toBe('')
    el.scrollTop = 0
    touch('touchstart', 200) // from the top of the content, which then scrolls before moving down
    el.scrollTop = 30
    touch('touchmove', 400)
    expect(el.style.translate).toBe('')
  })
})
