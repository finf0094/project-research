import { User, type Role } from '@exam/contracts'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { deletePackage, listPackages } from '@/modules/offline'
import { ApiError, request } from '@/shared/lib/http'

const CACHE_KEY = 'exam.user'

/**
 * The signed-in user. The last known user is cached so a student who reloads the exam page
 * without network keeps working; the server still checks the session on every request.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(readCache())
  const role = computed<Role | null>(() => user.value?.role ?? null)

  async function refresh() {
    try {
      setUser(await request('/auth/me', {}, User))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null)
      // Network errors keep the cached user: the exam must keep running offline.
    }
  }

  async function login(email: string, password: string) {
    setUser(await request('/auth/login', { method: 'POST', body: { email, password } }, User))
  }

  async function logout() {
    const userId = user.value?.id
    await request('/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
    // On a shared device the next person must not find this student's packages (their chain keys).
    // Best effort: logging out must not fail because local storage did.
    if (userId)
      await listPackages(userId)
        .then((pkgs) => Promise.all(pkgs.map((p) => deletePackage(userId, p.examId))))
        .catch(() => undefined)
  }

  function setUser(next: User | null) {
    user.value = next
    try {
      if (next) localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      else localStorage.removeItem(CACHE_KEY)
    } catch {
      /* storage unavailable: the cache is only a convenience */
    }
  }

  return { user, role, refresh, login, logout }
})

function readCache(): User | null {
  try {
    const parsed = User.safeParse(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
