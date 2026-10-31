<script setup lang="ts">
import { Flag } from 'lucide-vue-next'
import { TEXT_SIZES, type TextSize } from '../reading'

/** Reading comfort and memory: the text size, and a mark to come back to this question. */
const size = defineModel<TextSize>('size', { required: true })
defineProps<{ flagged: boolean }>()
defineEmits<{ flag: [] }>()
</script>

<template>
  <div class="tools">
    <div class="sizes" role="radiogroup" :aria-label="$t('exam.tools.size')">
      <button
        v-for="s in TEXT_SIZES"
        :key="s"
        type="button"
        role="radio"
        :class="[s, { on: size === s }]"
        :aria-checked="size === s"
        :aria-label="$t(`exam.tools.sizes.${s}`)"
        @click="size = s"
      >
        A
      </button>
    </div>
    <button
      type="button"
      class="flag"
      :class="{ on: flagged }"
      :aria-pressed="flagged"
      @click="$emit('flag')"
    >
      <Flag :size="16" aria-hidden="true" />
      {{ $t(flagged ? 'exam.tools.flagged' : 'exam.tools.flag') }}
    </button>
  </div>
</template>

<style scoped>
.tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sizes,
.flag {
  display: flex;
  align-items: center;
  block-size: 40px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
}
.sizes {
  padding: 4px;
  button {
    inline-size: 32px;
    block-size: 32px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--text-2);
    font-weight: 700;
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
    &.s {
      font-size: 12px;
    }
    &.m {
      font-size: 15px;
    }
    &.l {
      font-size: 18px;
    }
    &.on {
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-1);
    }
  }
}
.flag {
  gap: var(--space-2);
  padding: 0 var(--space-4);
  border: 0;
  color: var(--text-2);
  font-size: var(--text-sm);
  font-weight: 600;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
  &.on {
    background: var(--warn-tint);
    color: var(--warn);
    svg {
      fill: currentColor;
      animation: wave var(--dur-slow) var(--ease-spring);
    }
  }
}
@keyframes wave {
  30% {
    rotate: -14deg;
  }
}
</style>
