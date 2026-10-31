<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { AppLogo } from '@/shared/ui'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="shell">
    <header class="bar">
      <RouterLink to="/" class="home" aria-label="На главную"><AppLogo /></RouterLink>
      <div class="user">
        <span class="name">{{ auth.user?.name }}</span>
        <button type="button" class="logout" aria-label="Выйти" @click="logout"><LogOut :size="20" /></button>
      </div>
    </header>
    <div class="content"><slot /></div>
  </div>
</template>

<style scoped>
.shell {
  width: min(1240px, 100%);
  margin-inline: auto;
  padding: var(--space-4);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: var(--space-2) var(--space-6);
}
.home {
  color: inherit;
  text-decoration: none;
}
.user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.name {
  font-weight: 600;
}
.logout {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.content :deep(> main) {
  padding: 0;
}
</style>
