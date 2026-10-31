<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'

/** A number that counts to its new value instead of jumping (stat tiles, scores). */
const props = defineProps<{ value: number; duration?: number }>()
const shown = ref(props.value)
let frame = 0

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

watch(
  () => props.value,
  (to, from) => {
    cancelAnimationFrame(frame)
    if (reduced() || from === undefined) return void (shown.value = to)
    const start = performance.now()
    const length = props.duration ?? 600
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / length)
      const eased = 1 - (1 - t) ** 3
      shown.value = Math.round(from + (to - from) * eased)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  },
)
onScopeDispose(() => cancelAnimationFrame(frame))
</script>

<template>
  <span class="count">{{ shown }}</span>
</template>

<style scoped>
.count {
  font-variant-numeric: tabular-nums;
}
</style>
