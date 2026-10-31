<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALE_NAMES, LOCALES } from '@/shared/i18n'

const { locale, t } = useI18n()
</script>

<template>
  <select v-model="locale" class="locale" :aria-label="t('common.language')">
    <option v-for="code in LOCALES" :key="code" :value="code" :lang="code">{{ LOCALE_NAMES[code] }}</option>
  </select>
</template>

<style scoped>
.locale {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: inherit;
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}
</style>
