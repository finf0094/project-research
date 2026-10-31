<script setup lang="ts">
import { Flag } from 'lucide-vue-next'
import { useId } from 'vue'
import { TEXT_SIZES, type TextSize } from '../reading'

/** Reading comfort and memory: the text size, and a mark to come back to this question. */
const size = defineModel<TextSize>('size', { required: true })
defineProps<{ flagged: boolean }>()
defineEmits<{ flag: [] }>()
const name = useId()
</script>

<template>
  <div class="tools">
    <!-- Native radios: arrow keys and one tab stop come for free. -->
    <fieldset class="sizes">
      <legend class="visually-hidden">{{ $t('exam.tools.size') }}</legend>
      <label v-for="s in TEXT_SIZES" :key="s" :class="[s, { on: size === s }]">
        <input v-model="size" class="visually-hidden" type="radio" :value="s" :name="name" />
        <span aria-hidden="true">A</span>
        <span class="visually-hidden">{{ $t(`exam.tools.sizes.${s}`) }}</span>
      </label>
    </fieldset>
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
  margin: 0;
  padding: 4px;
  border: 0;
  label {
    display: grid;
    place-items: center;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    cursor: pointer;
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
    &:has(:focus-visible) {
      outline: 3px solid var(--accent);
      outline-offset: 1px;
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
