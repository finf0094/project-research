import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useNewVersionOnNextPage } from './new-version'

describe('a new version of the site', () => {
  const component = { render: () => null }
  const setup = (controller: object | null) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/exams', component, meta: { shell: 'student' } },
        { path: '/examiner/exams/:id/edit', component, meta: { shell: 'staff' } },
        { path: '/attempts/:id', component },
      ],
    })
    const worker = new EventTarget() as ServiceWorkerContainer
    Object.defineProperty(worker, 'controller', { value: controller })
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    useNewVersionOnNextPage(router, worker)
    return { router, assign, update: () => worker.dispatchEvent(new Event('controllerchange')) }
  }
  afterEach(() => vi.unstubAllGlobals())

  it('loads afresh on the next move to an ordinary page, never in the middle of one', async () => {
    const { router, assign, update } = setup({})
    await router.push('/examiner/exams/1/edit')
    update()
    expect(assign).not.toHaveBeenCalled() // the open editor keeps its unsaved changes
    await router.push('/exams?tab=all')
    expect(assign).toHaveBeenCalledWith('/exams?tab=all')
    expect(router.currentRoute.value.path).toBe('/examiner/exams/1/edit')
  })

  it('lets exam pages run the version they started with', async () => {
    const { router, assign, update } = setup({})
    await router.push('/exams')
    update()
    await router.push('/attempts/a')
    expect(assign).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/attempts/a')
  })

  it('does nothing on the first visit, when the worker only takes control', async () => {
    const { router, assign, update } = setup(null)
    update()
    await router.push('/exams')
    expect(assign).not.toHaveBeenCalled()
  })
})
