<script setup lang="ts">
import { ArrowDown } from 'lucide-vue-next'
import { onScopeDispose, ref, watch } from 'vue'

/**
 * Phones and narrow screens stack the decision under the markers and answers: a pinned button above the
 * tab bar takes the examiner there, and goes away while the decision is on screen (or above it).
 */
const props = defineProps<{ target: HTMLElement | null }>()
const away = ref(false)

let observer: IntersectionObserver | null = null
watch(
  () => props.target,
  (el) => {
    observer?.disconnect()
    if (!el || typeof IntersectionObserver === 'undefined') return
    observer = new IntersectionObserver(([entry]) => {
      away.value = !!entry && !entry.isIntersecting && entry.boundingClientRect.top > 0
    })
    observer.observe(el)
  },
  { immediate: true },
)
onScopeDispose(() => observer?.disconnect())

function jump() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  props.target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  // The first choice takes focus without a second jump, so keyboards and screen readers land there too.
  props.target?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true })
}
</script>

<template>
  <!-- On the body: the page's slide-in animation would otherwise pin it to the page, not the screen. -->
  <Teleport to="body">
    <Transition name="jump">
      <button v-if="away" type="button" class="jump press" @click="jump">
        <ArrowDown :size="18" aria-hidden="true" />
        {{ $t('review.attempt.toDecision') }}
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.jump {
  display: none;
}
@media (width < 1000px) {
  .jump {
    position: fixed;
    z-index: 15;
    inset-inline: 50% auto;
    inset-block-end: max(var(--space-4), env(safe-area-inset-bottom));
    translate: -50% 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--tap);
    padding: 0 var(--space-5);
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--ink);
    color: var(--on-ink);
    box-shadow: var(--shadow-2);
    font-weight: 600;
    white-space: nowrap;
  }
}
/* Above the phone's tab bar. */
@media (width < 700px) {
  .jump {
    inset-block-end: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-3));
  }
}
.jump-enter-active,
.jump-leave-active {
  transition:
    opacity var(--dur) var(--ease),
    translate var(--dur) var(--ease);
}
.jump-enter-from,
.jump-leave-to {
  opacity: 0;
  translate: -50% var(--space-4);
}
</style>
