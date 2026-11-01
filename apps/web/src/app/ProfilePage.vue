<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { AppButton, AppCard, Avatar, LocaleSwitch } from '@/shared/ui'

/**
 * The account, as the last tab of the phone's tab bar: who is signed in, the language, signing out.
 * (Wide screens reach the same from the initials menu and the language switch in the top bar.)
 */
const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <main v-if="auth.user" class="profile stagger">
    <AppCard class="who">
      <Avatar :name="auth.user.name" :size="72" />
      <div>
        <h1>{{ auth.user.name }}</h1>
        <p class="muted">{{ auth.user.email }} · {{ $t(`admin.roles.${auth.user.role}`) }}</p>
      </div>
    </AppCard>
    <AppCard class="setting">
      <h2>{{ $t('common.language') }}</h2>
      <LocaleSwitch />
    </AppCard>
    <AppButton variant="secondary" block class="logout" @click="logout">
      <LogOut :size="18" aria-hidden="true" /> {{ $t('app.logout') }}
    </AppButton>
  </main>
</template>

<style scoped>
.profile {
  display: grid;
  gap: var(--space-4);
  max-inline-size: 560px;
}
.who {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  h1 {
    font-size: var(--text-xl);
  }
  p {
    overflow-wrap: anywhere;
  }
}
.setting {
  display: grid;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-md);
  }
}
.logout {
  color: var(--danger);
}
</style>
