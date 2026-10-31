<script setup lang="ts">
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-vue-next'
import { computed } from 'vue'
import { IconTile } from '@/shared/ui'
import type { PreflightCheck } from '../preflight-checks'

/** Everything checked before the exam, one row each, with how many already pass. */
const props = defineProps<{ checks: PreflightCheck[] }>()
const passed = computed(() => props.checks.filter((c) => c.status === 'ok').length)
</script>

<template>
  <section class="card">
    <header>
      <h2>{{ $t('exam.preflight.checks') }}</h2>
      <span class="count" :class="{ done: passed === checks.length }">{{ passed }}/{{ checks.length }}</span>
    </header>
    <ul class="stagger">
      <li v-for="check in checks" :key="check.id" :class="check.status">
        <IconTile :icon="check.icon" :tone="check.tone" />
        <span class="text">
          <span class="title">{{ check.title }}</span>
          <span class="note">{{ check.note }}</span>
        </span>
        <Transition name="swap" mode="out-in">
          <CircleCheck v-if="check.status === 'ok'" key="ok" class="mark ok" :size="24" />
          <CircleAlert v-else-if="check.status === 'bad'" key="bad" class="mark bad" :size="24" />
          <LoaderCircle v-else key="pending" class="mark spin" :size="22" />
        </Transition>
        <span class="visually-hidden">{{ $t(`exam.preflight.status.${check.status}`) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  h2 {
    font-size: var(--text-lg);
  }
}
.count {
  color: var(--text-2);
  font-family: var(--font-display);
  font-weight: 700;
  transition: color var(--dur) var(--ease);
  &.done {
    color: var(--ok);
  }
}
ul {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.text {
  display: grid;
  flex: 1;
}
.title {
  font-weight: 600;
}
.note {
  color: var(--text-2);
  font-size: var(--text-sm);
}
.bad .note {
  color: var(--warn);
}
.mark {
  flex: none;
  &.ok {
    color: var(--ok);
  }
  &.bad {
    color: var(--warn);
  }
  &.spin {
    color: var(--text-2);
    animation: spin 1s linear infinite;
  }
}
@keyframes spin {
  to {
    rotate: 1turn;
  }
}
.swap-enter-active {
  transition:
    opacity var(--dur-fast) var(--ease),
    scale var(--dur) var(--ease-spring);
}
.swap-enter-from {
  opacity: 0;
  scale: 0.4;
}
</style>
