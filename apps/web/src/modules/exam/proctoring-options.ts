import type { EventLog, LocalAttempt, ServerClock } from '@/modules/offline'

/** What proctoring needs to watch this attempt, taken from the attempt's exam profile. */
export function proctoringOptions(local: LocalAttempt, log: EventLog, clock: ServerClock) {
  return {
    attemptId: local.id,
    log,
    recording: local.exam.profile.recording,
    // In an oral exam the student talks the whole time: sound says nothing there.
    listen: local.exam.profile.mode !== 'oral',
    ignore: local.disabledSignals ?? [],
    now: () => clock.now(),
  }
}
