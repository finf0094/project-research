import type { EventLog, LocalAttempt, ServerClock } from '@/modules/offline'

/** What proctoring needs to watch this attempt, taken from the attempt's exam profile. */
/** `send`: sends the log now, so a new signal reaches the server within seconds. */
export function proctoringOptions(local: LocalAttempt, log: EventLog, clock: ServerClock, send: () => void) {
  return {
    attemptId: local.id,
    log,
    recording: local.exam.profile.recording,
    // In an oral exam the student talks the whole time: sound says nothing there.
    listen: local.exam.profile.mode !== 'oral',
    ignore: local.disabledSignals ?? [],
    now: () => clock.now(),
    onSignal: send,
  }
}
