<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppButton, AppField, AppLogo, LocaleSwitch } from '@/shared/ui'
import { useAction } from '@/shared/lib/use-action'
import { useAuthStore } from '../auth.store'
import BrandArt from '../components/BrandArt.vue'
import PasswordField from '../components/PasswordField.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
// Wrong password and too many tries are this page's own words; no network or a server down get the
// app's common messages (a server error used to read as "no internet").
const signIn = useAction({ 401: 'auth.badCredentials' as const, 429: 'auth.tooMany' as const })
const error = signIn.error
const loading = signIn.busy

const submit = () =>
  signIn.run(async () => {
    await auth.login(email.value.trim(), password.value)
    // Only same-app paths: an open redirect would let a link send students to a fake page after sign-in.
    const next =
      typeof route.query.next === 'string' && /^\/(?!\/)/.test(route.query.next) ? route.query.next : null
    // '/' sends each role to its home (app/router.ts).
    await router.replace(next ?? '/')
  })
</script>

<template>
  <main class="login">
    <BrandArt class="brand" />

    <section class="panel">
      <LocaleSwitch class="locale" />
      <div class="mobile-top" aria-hidden="true">
        <AppLogo inverted class="mobile-logo" />
      </div>
      <form class="form stagger" @submit.prevent="submit">
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
.mobile-top {
  display: none;
}
/*
 * Phones: an app's sign-in screen. The brand sits on a dark top, the form is a sheet that slides up from
 * the bottom edge (within reach of the thumb) and runs under the home indicator.
 */
@media (width < 800px) {
  .login {
    grid-template-columns: 1fr;
    background: var(--ink);
  }
  .brand {
    display: none;
  }
  .panel {
    grid-template-rows: auto 1fr auto auto;
    justify-items: stretch;
    gap: 0;
    padding: 0;
  }
  .locale {
    margin: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) 0;
  }
  .mobile-top {
    position: relative;
    display: grid;
    place-items: center;
    min-block-size: 140px;
    overflow: hidden;
    color: var(--on-ink);
    /* Two dashed rings, as on the student's exam card. */
    &::before,
    &::after {
      content: '';
      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      inline-size: 320px;
      aspect-ratio: 1;
      border: 1px dashed var(--on-ink-tint-3);
      border-radius: 50%;
      translate: -50% -50%;
    }
    &::after {
      inline-size: 200px;
    }
  }
  .mobile-logo {
    position: relative;
    z-index: 1;
    scale: 1.4;
    animation: pop var(--dur-slow) var(--ease-spring) both;
  }
  .form {
    inline-size: 100%;
    align-self: end;
    padding: var(--space-8) var(--space-5) var(--space-4);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--bg);
    animation: sheet-up var(--dur-slow) var(--ease) both;
  }
  .help {
    inline-size: 100%;
    padding: var(--space-2) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom));
    background: var(--bg);
    summary {
      display: flex;
      align-items: center;
      justify-content: center;
      min-block-size: var(--tap);
    }
  }
}
@keyframes sheet-up {
  from {
    translate: 0 40px;
    opacity: 0;
  }
}
</style>
