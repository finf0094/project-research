<script setup lang="ts">
import { AppButton } from '@/shared/ui'

/** A lost link: say so plainly, offer the way home or back. The logo's linked squares stand in for the 0. */
const canGoBack = history.length > 1
</script>

<template>
  <main class="page">
    <section class="card">
      <p class="code" aria-hidden="true">
        4<svg viewBox="0 0 120 64" fill="none">
          <rect x="4" y="4" width="62" height="56" rx="18" class="left" stroke-width="9" />
          <rect x="54" y="4" width="62" height="56" rx="18" class="right" stroke-width="9" /></svg
        >4
      </p>
      <h1>{{ $t('app.notFound') }}</h1>
      <p class="muted">{{ $t('app.notFoundHint') }}</p>
      <div class="actions">
        <AppButton icon="arrow" @click="$router.replace('/')">{{ $t('app.home') }}</AppButton>
        <AppButton v-if="canGoBack" variant="secondary" @click="$router.back()">{{
          $t('common.back')
        }}</AppButton>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-4);
}
.card {
  display: grid;
  gap: var(--space-4);
  justify-items: center;
  max-inline-size: 520px;
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-2);
  text-align: center;
  animation: rise var(--dur-slow) var(--ease) both;
}
.code {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--accent);
  font-family: var(--font-display);
  font-size: clamp(4rem, 14vw, 6.5rem);
  font-weight: 700;
  line-height: 1;
  svg {
    inline-size: 1.3em;
    animation: wobble 3.2s var(--ease) infinite;
  }
  .left {
    stroke: var(--lime);
  }
  .right {
    stroke: var(--text);
  }
}
@keyframes wobble {
  25% {
    rotate: -6deg;
  }
  75% {
    rotate: 6deg;
  }
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
@media (prefers-reduced-motion: reduce) {
  .code svg {
    animation: none;
  }
}
</style>
