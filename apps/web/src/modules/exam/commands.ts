import type { Command } from '@exam/contracts'
import type { EventLog } from '@/modules/offline'

interface Handlers {
  warn(message: string): void
  capture(seconds: number): void
}

/**
 * Examiner and server commands that arrive with sync replies. The server repeats a command until the
 * chain acknowledges it, so each one is handled once and then acknowledged with `command.received`.
 */
export function createCommandInbox(handlers: Handlers) {
  const handled = new Set<string>()
  return {
    async receive(commands: Command[], log: EventLog) {
      for (const command of commands) {
        if (handled.has(command.id)) continue
        handled.add(command.id)
        if (command.type === 'warn') handlers.warn(command.message)
        if (command.type === 'capture') handlers.capture(command.seconds)
        await log.append('command.received', { commandId: command.id })
      }
    },
    clear: () => handled.clear(),
  }
}
