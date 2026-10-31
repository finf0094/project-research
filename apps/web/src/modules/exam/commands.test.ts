import { describe, expect, it, vi } from 'vitest'
import type { EventLog } from '@/modules/offline'
import { createCommandInbox } from './commands'

describe('createCommandInbox', () => {
  it('handles each command once and acknowledges it in the chain', async () => {
    const warn = vi.fn()
    const capture = vi.fn()
    const append = vi.fn(async () => undefined)
    const log = { append } as unknown as EventLog
    const inbox = createCommandInbox({ warn, capture })
    const commands = [
      { id: 'c1', type: 'warn' as const, message: 'Смотрите на экран', createdAt: 0 },
      { id: 'c2', type: 'capture' as const, seconds: 20, createdAt: 0 },
    ]
    await inbox.receive(commands, log)
    await inbox.receive(commands, log) // repeated until acknowledged
    expect(warn).toHaveBeenCalledOnce()
    expect(capture).toHaveBeenCalledWith(20)
    expect(append.mock.calls).toEqual([
      ['command.received', { commandId: 'c1' }],
      ['command.received', { commandId: 'c2' }],
    ])
  })
})
