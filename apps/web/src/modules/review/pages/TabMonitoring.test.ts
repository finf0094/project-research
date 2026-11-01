import type { AttemptSummary } from '@exam/contracts'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AttemptsTable from '../components/AttemptsTable.vue'
import CommandDialog from '../components/CommandDialog.vue'
import TabMonitoring from './TabMonitoring.vue'

// Each command stays on its way until the test answers it.
const answers: (() => void)[] = []
const sendCommand = vi.fn(
  (_id: string, _body: unknown) => new Promise<void>((resolve) => answers.push(resolve)),
)
vi.mock('../api', () => ({ sendCommand: (id: string, body: unknown) => sendCommand(id, body) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../exam-hub', () => ({
  useExamHub: () => ({
    exam: ref({ mode: 'written', participants: 2, attempts: { active: 2 } }),
    attempts: ref([]),
    alerts: ref([]),
    now: ref(0),
    refresh: async () => undefined,
  }),
}))

const student = (id: string) => ({ id, student: { id, name: id } }) as AttemptSummary
describe('TabMonitoring', () => {
  it('sends a command to one student while another one is still on its way to someone else', async () => {
    const wrapper = mount(TabMonitoring, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { AttemptsTable: true, CommandDialog: true, AlertsFeed: true, StatTile: true, PillTabs: true },
      },
    })
    const table = wrapper.findComponent(AttemptsTable)
    const dialog = wrapper.findComponent(CommandDialog)
    const warn = { type: 'warn', message: 'eyes on your screen' }

    table.vm.$emit('act', student('a'))
    await flushPromises()
    dialog.vm.$emit('send', warn)
    dialog.vm.$emit('send', warn) // a double click: the same student gets it once
    await flushPromises()
    expect(dialog.props('sending')).toBe(true)

    table.vm.$emit('act', student('b'))
    await flushPromises()
    expect(dialog.props('sending')).toBe(false)
    dialog.vm.$emit('send', warn)
    await flushPromises()
    expect(sendCommand.mock.calls.map(([id]) => id)).toEqual(['a', 'b'])

    answers.forEach((answer) => answer())
    await flushPromises()
    expect(dialog.props('attempt')).toBeNull()
  })
})
