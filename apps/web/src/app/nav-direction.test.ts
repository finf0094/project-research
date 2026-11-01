import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { navDirection, trackNavDirection } from './nav-direction'

describe('which way a page slides', () => {
  it('goes deeper from the right and back up from the left', () => {
    expect(navDirection('/attempts/a/result', '/results', false)).toBe('forward')
    expect(navDirection('/results', '/attempts/a/result', false)).toBe('back')
    expect(navDirection('/examiner/exams/1', '/examiner', false)).toBe('forward')
  })

  it('follows the tab order between tabs', () => {
    expect(navDirection('/results', '/exams', false)).toBe('tab-forward')
    expect(navDirection('/exams', '/profile', false)).toBe('tab-back')
    expect(navDirection('/profile', '/calibration', false)).toBe('tab-forward')
  })

  it('switches tabs by their order from deep inside a tab too', () => {
    expect(navDirection('/calibration', '/examiner/exams/1/monitoring', false)).toBe('tab-forward')
    // A result page belongs to Results: Profile is to its right, Exams to its left.
    expect(navDirection('/profile', '/attempts/a/result', false)).toBe('tab-forward')
    expect(navDirection('/exams', '/attempts/a/result', false)).toBe('tab-back')
  })

  it('treats the system back gesture as back', () => {
    expect(navDirection('/examiner/exams/1', '/examiner/exams/1/monitoring', true)).toBe('back')
  })
})

describe('marking the navigation', () => {
  const component = { render: () => null }
  const paths = ['/exams', '/results', '/profile', '/attempts/:id/result']
  const setup = () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: paths.map((path) => ({ path, component })),
    })
    router.beforeEach((to) => to.query.block === undefined)
    trackNavDirection(router)
    return router
  }
  const nav = () => document.documentElement.dataset.nav
  afterEach(() => delete document.documentElement.dataset.nav)

  it('lets the first page rise in, without a slide', async () => {
    const router = setup()
    await router.push('/exams')
    expect(nav()).toBeUndefined()
  })

  it('ignores navigations that did not happen', async () => {
    const router = setup()
    await router.push('/exams')
    await router.push('/results')
    expect(nav()).toBe('tab-forward')
    await router.push('/results') // the active tab tapped again
    await router.push('/exams?block')
    expect(nav()).toBe('tab-forward')
  })
  it('reads the history position: going back to a deeper page still slides back', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: paths.map((path) => ({ path, component })),
    })
    trackNavDirection(router)
    await router.push('/results')
    await router.push('/attempts/a/result')
    expect(nav()).toBe('forward')
    await router.replace('/attempts/b/result') // a replace keeps the position: not back
    expect(nav()).toBe('forward')
    await router.push('/profile')
    expect(nav()).toBe('tab-forward')
    const popped = new Promise((done) => router.afterEach(() => done(null)))
    router.back()
    await popped
    expect(router.currentRoute.value.path).toBe('/attempts/b/result')
    expect(nav()).toBe('back')
  })
})
