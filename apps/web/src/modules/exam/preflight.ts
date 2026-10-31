export interface Check {
  id: string
  title: string
  ok: boolean
  /** Shown when the check fails: what the student can do about it. */
  hint: string
}

/**
 * Browser checks that do not need a camera. The exam must not start on a browser that
 * cannot keep answers offline, because that is exactly what protects the student.
 */
export async function runBrowserChecks(): Promise<Check[]> {
  const supported = 'indexedDB' in window && !!crypto.subtle && 'locks' in navigator
  // Asks the browser not to evict our data under storage pressure (answers live there until delivered).
  const persisted = (await navigator.storage?.persist?.().catch(() => false)) ?? false
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
  const freeMb =
    estimate?.quota && estimate.usage !== undefined ? (estimate.quota - estimate.usage) / 1_048_576 : null
  return [
    {
      id: 'browser',
      title: 'Браузер',
      ok: supported,
      hint: 'Откройте экзамен в свежей версии Chrome, Edge, Firefox или Safari.',
    },
    {
      id: 'storage',
      title: 'Место для ответов на устройстве',
      ok: freeMb === null || freeMb > 200,
      hint: 'Освободите место на диске: ответы и запись хранятся на устройстве, пока не отправятся.',
    },
    {
      id: 'persist',
      title: 'Надёжное хранение',
      // Not every browser grants persistence; the exam still works, so this is informational.
      ok: true,
      hint: persisted
        ? ''
        : 'Браузер может очистить данные при нехватке места — не закрывайте вкладку до отправки.',
    },
  ]
}
