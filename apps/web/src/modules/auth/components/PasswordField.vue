<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'
import { ref } from 'vue'
import { AppField } from '@/shared/ui'

/** The password with a button to show it while typing (a long university password is easy to mistype). */
defineProps<{ error?: string }>()
const model = defineModel<string>({ required: true })
const shown = ref(false)
</script>

<template>
  <AppField
    v-model="model"
    :label="$t('auth.password')"
    :type="shown ? 'text' : 'password'"
    autocomplete="current-password"
    required
    :error="error"
  >
    <template #trailing>
      <button
        type="button"
        class="toggle"
        :aria-pressed="shown"
        :aria-label="$t('auth.showPassword')"
        @click="shown = !shown"
      >
        <component :is="shown ? EyeOff : Eye" :size="18" aria-hidden="true" />
      </button>
    </template>
  </AppField>
</template>

<style scoped>
.toggle {
  display: grid;
  place-items: center;
  inline-size: var(--tap);
  block-size: var(--tap);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-2);
  &:hover {
    color: var(--text);
  }
}
</style>
