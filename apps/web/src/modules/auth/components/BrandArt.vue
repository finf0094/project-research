<script setup lang="ts">
/**
 * The sign-in page's brand side: the two linked squares of the logo breathing in the middle, orbits slowly
 * turning around them with small satellites, and the wordmark. Pure decoration (hidden from readers);
 * every motion stops for people who ask for reduced motion.
 */
</script>

<template>
  <aside class="art" aria-hidden="true">
    <div class="orbit outer"><span class="moon lime" /><span class="moon soft" /></div>
    <div class="orbit inner"><span class="moon accent" /></div>
    <svg class="mark" viewBox="0 0 120 64" fill="none">
      <rect x="4" y="4" width="62" height="56" rx="18" class="left" stroke-width="8" />
      <rect x="54" y="4" width="62" height="56" rx="18" class="right" stroke-width="8" />
    </svg>
    <p class="wordmark">exam<span>.</span></p>
  </aside>
</template>

<style scoped>
.art {
  position: relative;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  padding: var(--space-12);
  background: var(--ink);
}
.orbit {
  position: absolute;
  inset-block-start: 42%;
  inset-inline-start: 50%;
  border: 1px dashed var(--on-ink-line);
  border-radius: 50%;
  translate: -50% -50%;
  animation: turn 60s linear infinite;
  &.outer {
    inline-size: min(78%, 520px);
    aspect-ratio: 1;
  }
  &.inner {
    inline-size: min(52%, 340px);
    aspect-ratio: 1;
    animation-duration: 40s;
    animation-direction: reverse;
  }
}
.moon {
  position: absolute;
  border-radius: 50%;
  &.lime {
    inset: 18% auto auto 4%;
    inline-size: 14px;
    block-size: 14px;
    background: var(--lime);
  }
  &.soft {
    inset: auto 12% 8% auto;
    inline-size: 22px;
    block-size: 22px;
    background: var(--on-ink-tint-3);
  }
  &.accent {
    inset: -18px auto auto 60%;
    inline-size: 36px;
    block-size: 36px;
    border-radius: 10px;
    background: var(--accent);
  }
}
@keyframes turn {
  to {
    rotate: 1turn;
  }
}
.mark {
  position: absolute;
  inset-block-start: 42%;
  inset-inline-start: 50%;
  inline-size: min(46%, 300px);
  translate: -50% -50%;
  animation: breathe-mark 5s var(--ease) infinite;
  .left {
    stroke: var(--lime);
  }
  .right {
    stroke: var(--on-ink);
  }
}
@keyframes breathe-mark {
  50% {
    scale: 1.04;
  }
}
.wordmark {
  position: relative;
  color: var(--on-ink);
  font-family: var(--font-display);
  font-size: clamp(4rem, 9vw, 8rem);
  font-weight: 700;
  line-height: 1;
  animation: rise var(--dur-slow) var(--ease) both;
  span {
    color: var(--lime);
  }
}
@media (prefers-reduced-motion: reduce) {
  .orbit,
  .mark {
    animation: none;
  }
}
</style>
