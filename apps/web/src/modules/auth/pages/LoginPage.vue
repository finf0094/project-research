<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppButton, AppField, AppLogo, LocaleSwitch } from '@/shared/ui'
import { ApiError } from '@/shared/lib/http'
import { useAuthStore } from '../auth.store'
import BrandArt from '../components/BrandArt.vue'
import PasswordField from '../components/PasswordField.vue'
import { homeFor } from '../home'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
/** A message key, so the text follows a language switch. */
const error = ref<'auth.badCredentials' | 'auth.tooMany' | 'auth.offline' | null>(null)
const loading = ref(false)

async function submit() {
  error.value = null
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    // Only same-app paths: an open redirect would let a link send students to a fake page after sign-in.
    const next =
      typeof route.query.next === 'string' && /^\/(?!\/)/.test(route.query.next) ? route.query.next : null
    await router.replace(next ?? homeFor(auth.role))
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0
    error.value = status === 401 ? 'auth.badCredentials' : status === 429 ? 'auth.tooMany' : 'auth.offline'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <BrandArt class="brand" />

    <section class="panel">
      <LocaleSwitch class="locale" />
      <form class="form stagger" @submit.prevent="submit">
        <AppLogo class="mobile-logo" />
        <h1>{{ $t('auth.title') }}</h1>
        <p class="muted">{{ $t('auth.subtitle') }}</p>
        <AppField
          v-model="email"
          label="Email"
          type="email"
          autocomplete="username"
          placeholder="name@university.edu"
          required
        />
        <PasswordField v-model="password" :error="error ? $t(error) : undefined" />
        <AppButton type="submit" block icon="arrow" :loading="loading">{{ $t('auth.submit') }}</AppButton>
      </form>
      <details class="help">
        <summary>{{ $t('auth.help') }}</summary>
        <p>{{ $t('auth.helpText') }}</p>
      </details>
    </section>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100dvh;
}
.panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
}
.locale {
  justify-self: end;
}
.form {
  display: grid;
  align-self: center;
  gap: var(--space-4);
  inline-size: min(360px, 100%);
  h1 {
    font-size: clamp(var(--text-2xl), 4vw, var(--text-3xl));
  }
}
.help {
  inline-size: min(360px, 100%);
  color: var(--text-2);
  font-size: var(--text-sm);
  text-align: center;
  summary {
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  p {
    margin-top: var(--space-2);
    animation: rise var(--dur) var(--ease) both;
  }
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
