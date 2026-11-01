<script setup lang="ts">
import { Camera, Lock, RotateCcw } from 'lucide-vue-next'
import { AppButton, IconTile } from '@/shared/ui'

/** The browser refused the camera: how to allow it, step by step, and a way to check again. */
defineEmits<{ retry: [] }>()
const STEPS = ['lock', 'allow', 'retry'] as const
</script>

<template>
  <section class="help" role="region" :aria-labelledby="'camera-help'">
    <header>
      <IconTile :icon="Camera" tone="accent" />
      <h2 id="camera-help">{{ $t('exam.cameraHelp.title') }}</h2>
    </header>
    <p class="text">{{ $t('exam.cameraHelp.text') }}</p>
    <div class="bar" aria-hidden="true">
      <span class="address"><Lock :size="14" /> exam</span>
      <span class="prompt"
        ><Camera :size="14" /> {{ $t('exam.cameraHelp.camera') }}
        <b>{{ $t('exam.cameraHelp.allowWord') }}</b></span
      >
    </div>
    <ol>
      <li v-for="(step, i) in STEPS" :key="step">
        <span class="n" aria-hidden="true">{{ i + 1 }}</span
        >{{ $t(`exam.cameraHelp.steps.${step}`) }}
      </li>
    </ol>
    <AppButton variant="ink" @click="$emit('retry')">
      <RotateCcw :size="16" aria-hidden="true" /> {{ $t('proctoring.check.again') }}
    </AppButton>
  </section>
</template>

<style scoped>
.help {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--accent-tint);
  animation: rise var(--dur-slow) var(--ease) both;
}
header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-lg);
  }
}
.text {
  color: var(--text-2);
  font-size: var(--text-sm);
}
/* A sketch of the browser's address bar and its permission prompt. */
.bar {
  display: grid;
  gap: var(--space-2);
  justify-self: stretch;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: var(--text-sm);
}
.address,
.prompt {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.address {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text-2);
}
.prompt {
  justify-self: start;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  box-shadow: var(--shadow-2);
  b {
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--ok-tint);
    color: var(--ok);
  }
}
ol {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
  font-size: var(--text-sm);
}
li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.n {
  display: grid;
  place-items: center;
  flex: none;
  inline-size: 24px;
  block-size: 24px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-weight: 700;
}
</style>
