<script setup lang="ts">
/**
 * The page is still loading: grey shapes of a header and a few cards (styles: .skeleton in app.css), so the
 * layout does not jump when the data arrives. Screen readers hear one "Loading…".
 */
withDefaults(defineProps<{ head?: boolean; cards?: number }>(), { head: true, cards: 3 })
</script>

<template>
  <div class="page-skeleton" role="status" :aria-label="$t('common.loading')">
    <span v-if="head" class="skeleton head" />
    <span v-for="n in cards" :key="n" class="skeleton card" />
  </div>
</template>

<style scoped>
.page-skeleton {
  display: grid;
  gap: var(--space-4);
  animation: fade-in var(--dur) var(--ease) both;
  /* A fast load never flashes the placeholder. */
  animation-delay: 120ms;
}
.head {
  block-size: 148px;
}
.card {
  block-size: 180px;
  &:nth-child(odd) {
    block-size: 120px;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
