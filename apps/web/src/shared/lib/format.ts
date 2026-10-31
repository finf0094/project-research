const pad = (n: number) => String(n).padStart(2, '0')

/** 5_025_000 → "01:23:45"; negative values clamp to zero. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

const timeFormat = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatTime = (ts: number) => timeFormat.format(ts)
export const formatDateTime = (ts: number) => dateFormat.format(ts)
