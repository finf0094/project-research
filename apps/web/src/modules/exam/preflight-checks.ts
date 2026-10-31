import { Camera, HardDrive, Laptop, Mic, Sun, User, Wifi } from 'lucide-vue-next'
import { computed, onMounted, ref, type Component, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { useDeviceProbe } from '@/modules/proctoring'
import { useOnline } from '@/shared/lib/use-online'
import { runBrowserChecks, type Check } from './preflight'

type Probe = ReturnType<typeof useDeviceProbe>

export interface PreflightCheck {
  id: string
  icon: Component
  tone: 'sky' | 'peach' | 'lime' | 'accent' | 'ok'
  title: string
  /** What is fine, or what to do when it is not. */
  note: string
  status: 'ok' | 'bad' | 'pending'
}

const DEVICE_LOOK = {
  camera: { icon: Camera, tone: 'sky' },
  mic: { icon: Mic, tone: 'peach' },
  face: { icon: User, tone: 'ok' },
  light: { icon: Sun, tone: 'peach' },
} as const
const BROWSER_LOOK = {
  browser: { icon: Laptop, tone: 'accent' },
  storage: { icon: HardDrive, tone: 'lime' },
  persist: { icon: HardDrive, tone: 'lime' },
} as const

/**
 * Every row of the preflight check: the camera probe's (pending until the camera runs), the browser's,
 * and the network (starting needs the server once). `ready`: all of them pass.
 */
export function usePreflightChecks(probe: Probe) {
  const { t } = useI18n()
  const online = useOnline()
  const browser: Ref<Check[] | null> = ref(null)
  onMounted(async () => (browser.value = await runBrowserChecks()))

  const checks = computed<PreflightCheck[]>(() => {
    const running = probe.state.value === 'running'
    const device = probe.checks.value.map((c) => ({
      id: c.id,
      ...DEVICE_LOOK[c.id],
      title: t(`proctoring.check.${c.id}`),
      status: c.ok ? 'ok' : running || probe.state.value === 'blocked' ? 'bad' : 'pending',
      note: c.ok ? t(`proctoring.check.ok.${c.id}`) : t(`proctoring.check.hint.${c.hint}`),
    })) satisfies PreflightCheck[]
    const net: PreflightCheck = {
      id: 'online',
      icon: Wifi,
      tone: 'sky',
      title: t('exam.preflight.online.title'),
      status: online.value ? 'ok' : 'bad',
      note: t(`exam.preflight.online.${online.value ? 'ok' : 'hint'}`),
    }
    const local = (browser.value ?? []).map((c) => ({
      id: c.id,
      ...BROWSER_LOOK[c.id],
      title: t(`exam.preflight.${c.id}.title`),
      status: c.ok ? 'ok' : 'bad',
      note: t(`exam.preflight.${c.id}.${c.advise ? 'hint' : 'ok'}`),
    })) satisfies PreflightCheck[]
    return [...device, net, ...local]
  })
  const ready = computed(() => !!browser.value && checks.value.every((c) => c.status === 'ok'))
  return { checks, ready }
}
