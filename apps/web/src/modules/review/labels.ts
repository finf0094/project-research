import type { AttemptStatus, MarkerKind, NetState } from '@exam/contracts'

type Tone = 'ok' | 'warn' | 'off' | 'accent' | 'danger'

export const MARKER_LABEL: Record<MarkerKind, string> = {
  face_missing: 'Нет лица в кадре',
  multiple_faces: 'Несколько людей в кадре',
  too_dark: 'Слишком темно',
  noise: 'Голос или шум',
  tab_hidden: 'Уход со вкладки',
  camera_off: 'Камера выключена',
  paste: 'Вставка текста',
  chain_broken: 'Журнал событий нарушен',
  missing_fragment: 'Фрагмент записи не загружен',
  offline: 'Без интернета',
}

export const STATUS_LABEL: Record<AttemptStatus, { text: string; tone: Tone }> = {
  active: { text: 'Пишет', tone: 'accent' },
  terminated: { text: 'Остановлен', tone: 'warn' },
  submitted: { text: 'Сдал · анализ записи', tone: 'accent' },
  ready_for_review: { text: 'Ждёт проверки', tone: 'warn' },
  decided: { text: 'Проверен', tone: 'ok' },
}

export const CONNECTION_LABEL: Record<NetState, { text: string; tone: Tone }> = {
  online: { text: 'В сети', tone: 'ok' },
  slow: { text: 'Слабая связь', tone: 'warn' },
  offline: { text: 'Без сети', tone: 'off' },
}
