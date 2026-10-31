<script setup lang="ts">
/** `inverted`: for dark surfaces (the staff sidebar): a lime mark, the word in the surrounding colour. */
withDefaults(defineProps<{ wordmark?: boolean; inverted?: boolean }>(), { wordmark: true })
</script>

<template>
  <span class="logo" :class="{ inverted }">
    <span class="mark" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
        <rect x="2" y="8" width="15" height="14" rx="4.5" class="left" stroke-width="2.8" />
        <rect x="13" y="8" width="15" height="14" rx="4.5" class="right" stroke-width="2.8" />
      </svg>
    </span>
    <span v-if="wordmark" class="word">exam</span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--ink);
}
.word {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-lg);
}
.left {
  stroke: var(--lime);
}
.right {
  stroke: var(--on-ink);
}
.inverted {
  .mark {
    background: var(--lime);
  }
  .left {
    stroke: var(--ink);
  }
  .right {
    stroke: var(--accent);
  }
}
</style>
