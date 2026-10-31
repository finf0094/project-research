<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { useId } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { placeUnderOpener } from '@/shared/lib/popover'
import { Avatar } from '@/shared/ui'

/** The signed-in person: their initials open a small menu with their name, role and sign-out. */
const auth = useAuthStore()
const router = useRouter()
const id = useId()

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div v-if="auth.user" class="user">
    <button type="button" class="opener" :popovertarget="id" :aria-label="auth.user.name">
      <Avatar :name="auth.user.name" :size="44" />
    </button>
    <div :id="id" popover class="menu" @beforetoggle="placeUnderOpener">
      <p class="name">{{ auth.user.name }}</p>
      <p class="muted role">{{ $t(`admin.roles.${auth.user.role}`) }}</p>
      <button type="button" class="logout" @click="logout">
        <LogOut :size="18" aria-hidden="true" /> {{ $t('app.logout') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.opener {
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  transition: scale var(--dur-fast) var(--ease-spring);
  &:hover {
    scale: 1.05;
  }
}
.menu {
  position: fixed;
  inset: auto;
  min-inline-size: 220px;
  margin: 0;
  padding: var(--space-4);
  border: 0;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-2);
  opacity: 0;
  translate: 0 -6px;
  transition:
    opacity var(--dur) var(--ease),
    translate var(--dur) var(--ease),
    display var(--dur) allow-discrete,
    overlay var(--dur) allow-discrete;
  &:popover-open {
    display: grid;
    gap: var(--space-1);
    opacity: 1;
    translate: 0 0;
    @starting-style {
      opacity: 0;
      translate: 0 -6px;
    }
  }
}
.name {
  font-weight: 700;
}
.role {
  font-size: var(--text-sm);
}
.logout {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-weight: 600;
}
</style>
