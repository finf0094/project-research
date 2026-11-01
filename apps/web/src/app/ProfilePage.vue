<script setup lang="ts">
import { Check, ChevronRight, LogOut } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { LOCALE_NAMES, LOCALES } from '@/shared/i18n'
import { Avatar, StatusPill } from '@/shared/ui'

/**
 * The account, as the last tab of the phone's tab bar: who is signed in, the language, signing out — laid
 * out like a native settings screen. (Wide screens reach the same from the initials menu and the top bar.)
 */
const auth = useAuthStore()
const router = useRouter()
const { locale } = useI18n()
const ROLE_TONE = { student: 'off', examiner: 'accent', admin: 'warn' } as const

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <main v-if="auth.user" class="profile stagger">
    <h1>{{ $t('app.nav.profile') }}</h1>
    <section class="who">
      <Avatar :name="auth.user.name" :size="64" />
      <div class="who-text">
        <h2>{{ auth.user.name }}</h2>
        <p class="muted">{{ auth.user.email }}</p>
        <StatusPill :tone="ROLE_TONE[auth.user.role]">{{ $t(`admin.roles.${auth.user.role}`) }}</StatusPill>
      </div>
    </section>
    <section class="group">
      <h2 class="group-title">{{ $t('common.language') }}</h2>
      <ul class="list-group" role="group" :aria-label="$t('common.language')">
        <li v-for="code in LOCALES" :key="code">
          <button
            type="button"
            class="list-row"
            :lang="code"
            :aria-pressed="locale === code"
            @click="locale = code"
          >
            <span class="code" aria-hidden="true">{{ code.toUpperCase() }}</span>
            <span class="list-row-text">{{ LOCALE_NAMES[code] }}</span>
            <Transition name="tick"
              ><Check v-if="locale === code" :size="20" class="tick" aria-hidden="true"
            /></Transition>
          </button>
        </li>
      </ul>
    </section>
    <div class="list-group">
      <button type="button" class="list-row logout" @click="logout">
        <span class="code" aria-hidden="true"><LogOut :size="18" /></span>
        <span class="list-row-text">{{ $t('app.logout') }}</span>
        <ChevronRight :size="18" class="chevron" aria-hidden="true" />
      </button>
    </div>
  </main>
</template>

<style scoped>
.profile {
  display: grid;
  gap: var(--space-5);
  max-inline-size: 560px;
}
.who {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.who-text {
  display: grid;
  justify-items: start;
  gap: var(--space-1);
  min-inline-size: 0;
  h2 {
    font-size: var(--text-lg);
  }
  p {
    overflow-wrap: anywhere;
  }
}
.group {
  display: grid;
  gap: var(--space-2);
}
.group-title {
  padding-inline: var(--space-4);
  color: var(--text-2);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.code {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: var(--text-xs);
  font-weight: 700;
}
[aria-pressed='true'] .code {
  background: var(--accent-tint);
  color: var(--accent-ink);
}
.tick {
  color: var(--accent-ink);
}
.tick-enter-active {
  animation: pop var(--dur) var(--ease-spring);
}
.logout {
  color: var(--danger);
  .code {
    background: var(--danger-tint);
    color: var(--danger);
  }
}
</style>
