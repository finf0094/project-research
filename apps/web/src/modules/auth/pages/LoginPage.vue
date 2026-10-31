<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppButton, AppField, AppLogo } from '@/shared/ui'
import { ApiError } from '@/shared/lib/http'
import { useAuthStore } from '../auth.store'
import { homeFor } from '../home'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    // Only same-app paths: an open redirect would let a link send students to a fake page after sign-in.
    const next =
      typeof route.query.next === 'string' && /^\/(?!\/)/.test(route.query.next) ? route.query.next : null
    await router.replace(next ?? homeFor(auth.role))
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 401
        ? 'Неверный email или пароль'
        : 'Нет связи с сервером. Попробуйте ещё раз.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <aside class="brand" aria-hidden="true">
      <div class="orbit" />
      <p class="wordmark">exam<span>.</span></p>
    </aside>

    <section class="panel">
      <form class="form" @submit.prevent="submit">
        <AppLogo class="mobile-logo" />
        <h1>С возвращением</h1>
        <p class="muted">Войдите через учётную запись университета.</p>
        <AppField
          v-model="email"
          label="Email"
          type="email"
          autocomplete="username"
          placeholder="name@university.edu"
          required
        />
        <AppField
          v-model="password"
          label="Пароль"
          type="password"
          autocomplete="current-password"
          required
          :error="error || undefined"
        />
        <AppButton type="submit" block :loading="loading">Войти</AppButton>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100dvh;
}
.brand {
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: var(--space-12);
  overflow: hidden;
  background: var(--ink);
}
.orbit {
  position: absolute;
  inset: 15% 10% auto;
  aspect-ratio: 1;
  border: 1px dashed rgb(255 255 255 / 0.15);
  border-radius: 50%;
}
.wordmark {
  font-family: var(--font-display);
  font-size: clamp(4rem, 9vw, 8rem);
  font-weight: 700;
  line-height: 1;
  color: #fff;
  span {
    color: var(--lime);
  }
}
.panel {
  display: grid;
  place-items: center;
  padding: var(--space-8) var(--space-4);
}
.form {
  display: grid;
  gap: var(--space-4);
  width: min(360px, 100%);
}
.mobile-logo {
  display: none;
}
@media (width < 800px) {
  .login {
    grid-template-columns: 1fr;
  }
  .brand {
    display: none;
  }
  .mobile-logo {
    display: inline-flex;
  }
}
</style>
