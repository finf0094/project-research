import '@fontsource-variable/golos-text'
import '@fontsource-variable/unbounded'
import './styles/index.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { useAuthStore } from '@/modules/auth'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'

const app = createApp(App).use(createPinia()).use(i18n)
const auth = useAuthStore()
// With a cached user the app opens at once (also offline) and the session is confirmed in the background;
// without one there is nothing to show before the server answers.
if (auth.user) void auth.refresh()
else await auth.refresh()
app.use(router).mount('#app')
