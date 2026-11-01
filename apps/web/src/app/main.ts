import '@fontsource-variable/golos-text'
import '@fontsource-variable/unbounded'
import './styles/index.css'
import { createPinia } from 'pinia'
import { createApp, watch } from 'vue'
import { useAuthStore } from '@/modules/auth'
import App from './App.vue'
import { i18n } from './i18n'
import { trackNavDirection } from './nav-direction'
import { router } from './router'

const app = createApp(App).use(createPinia()).use(i18n)
const auth = useAuthStore()
// With a cached user the app opens at once (also offline) and the session is confirmed in the background;
// without one there is nothing to show before the server answers.
if (auth.user) void auth.refresh()
else await auth.refresh()
trackNavDirection(router)
// A session that ends in the background (expired, signed out in another tab) leads back to sign-in from
// ordinary pages. Exam pages stay: they keep the answers on the device and ask to sign in again themselves.
watch(
  () => auth.user,
  (user) => {
    const route = router.currentRoute.value
    if (!user && route.meta.shell) void router.replace({ path: '/login', query: { next: route.fullPath } })
  },
)
app.use(router).mount('#app')
