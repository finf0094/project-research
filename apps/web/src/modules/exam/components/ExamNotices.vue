<script setup lang="ts">
defineProps<{ attemptId: string; signedOut: boolean; saveFailed: boolean; chainBroken: boolean }>()
</script>

<template>
  <div v-if="signedOut || saveFailed || chainBroken" class="notices" role="alert">
    <p v-if="saveFailed" class="notice">{{ $t('exam.notices.saveFailed') }}</p>
    <i18n-t v-if="signedOut" keypath="exam.notices.signedOut" tag="p" class="notice">
      <template #link>
        <RouterLink :to="`/login?next=/attempts/${attemptId}`">{{ $t('exam.notices.signIn') }}</RouterLink>
      </template>
    </i18n-t>
    <p v-if="chainBroken" class="notice">{{ $t('exam.notices.chainBroken') }}</p>
  </div>
</template>

<style scoped>
.notices {
  display: grid;
  gap: var(--space-2);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
}
</style>
