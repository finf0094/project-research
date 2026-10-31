<script setup lang="ts">
import type { NewUser, Role } from '@exam/contracts'
import { ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { AppButton } from '@/shared/ui'
import { createUser } from '../api'

const emit = defineEmits<{ created: [] }>()
const ROLES: Role[] = ['student', 'examiner', 'admin']
const empty = (): NewUser => ({ email: '', name: '', role: 'student', password: '' })
const user = ref(empty())
const action = useAction({ 409: 'admin.exists' as const })

async function submit() {
  if (await action.run(() => createUser(user.value))) {
    user.value = empty()
    emit('created')
  }
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <h2>{{ $t('admin.newUser') }}</h2>
    <label>
      {{ $t('admin.name') }}
      <input v-model.trim="user.name" required maxlength="200" autocomplete="off" />
    </label>
    <label>
      Email
      <input v-model.trim="user.email" type="email" required maxlength="200" autocomplete="off" />
    </label>
    <label>
      {{ $t('admin.role') }}
      <select v-model="user.role">
        <option v-for="role in ROLES" :key="role" :value="role">{{ $t(`admin.roles.${role}`) }}</option>
      </select>
    </label>
    <label>
      {{ $t('admin.password') }}
      <input v-model="user.password" type="password" required minlength="8" autocomplete="new-password" />
    </label>
    <p v-if="action.error.value" class="error" role="alert">{{ $t(action.error.value) }}</p>
    <AppButton type="submit" block :loading="action.busy.value">{{ $t('admin.create') }}</AppButton>
  </form>
</template>

<style scoped>
.form,
label {
  display: grid;
  gap: var(--space-3);
}
label {
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.error {
  color: var(--danger);
}
</style>
