import '@fontsource-variable/golos-text'
import '@fontsource-variable/unbounded'
import './styles/index.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { useAuthStore } from '@/modules/auth'
import App from './App.vue'
import { router } from './router'

const app = createApp(App).use(createPinia())
// Confirms the cached user with the server; offline, the cached user keeps the exam reachable.
await useAuthStore().refresh()
app.use(router).mount('#app')
