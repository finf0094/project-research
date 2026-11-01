<script setup lang="ts">
import { Maximize, Minimize } from 'lucide-vue-next'
import { SyncStatusBadge } from '@/modules/offline'
import { useFullscreen } from '@/shared/lib/use-fullscreen'
import { AppButton, AppLogo } from '@/shared/ui'
import ExamTimer from './ExamTimer.vue'

/** The exam's bar: what and where, whether everything is saved, focus mode, time left and submitting. */
defineProps<{ title: string; step: string; remainingMs: number; finishing: boolean }>()
defineEmits<{ finish: [] }>()
const focus = useFullscreen()
</script>

<template>
  <header class="header exam-bar">
    <div class="title">
      <AppLogo :wordmark="false" />
      <div>
        <h1 class="name">{{ title }}</h1>
        <p class="muted step">{{ step }}</p>
      </div>
    </div>
    <SyncStatusBadge class="badge" />
    <div class="actions">
      <button
        v-if="focus.supported"
        type="button"
        class="focus"
        :aria-pressed="focus.active.value"
        @click="focus.toggle"
      >
        <component :is="focus.active.value ? Minimize : Maximize" :size="16" aria-hidden="true" />
        <span class="focus-label">{{ $t('exam.header.focus') }}</span>
      </button>
      <ExamTimer :remaining-ms="remainingMs" />
      <AppButton class="submit" :loading="finishing" @click="$emit('finish')">{{
        $t('exam.header.submit')
      }}</AppButton>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.name {
  /* The page's heading, styled as plain header text. */
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: normal;
  line-height: 1.4;
}
.step {
  font-size: var(--text-sm);
}
.focus {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  block-size: 44px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: background-color var(--dur) var(--ease);
  &[aria-pressed='true'] {
    background: var(--accent-tint);
    color: var(--accent-ink);
  }
}
@media (width < 700px) {
  .focus-label {
    position: absolute;
    clip-path: inset(50%);
  }
}
.actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
/* Phones held upright: one compact pinned row (title, timer, submit) stays in reach while the question
   scrolls. Not in landscape, where it would eat a third of the screen. base.css keeps focus clear of it. */
@media (max-width: 900px) and (min-height: 600px) {
  .header {
    position: sticky;
    inset-block-start: var(--space-2);
    z-index: 2;
    flex-wrap: nowrap;
    gap: var(--space-2);
    padding: var(--space-3);
    box-shadow: var(--shadow-2);
  }
  .title {
    flex: 1;
    > div {
      min-width: 0;
    }
    :deep(.logo) {
      display: none;
    }
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .step,
  .badge {
    /* The text stays for screen readers; the badge keeps its coloured dot. */
    font-size: 0;
  }
  .step {
    position: absolute;
    clip-path: inset(50%);
  }
  .badge {
    gap: 0;
    padding: var(--space-2);
  }
  .actions {
    gap: var(--space-2);
  }
  /* Room for the title: phone browsers barely offer fullscreen; wider screens keep the button. */
  .focus {
    display: none;
  }
  .actions .submit {
    min-height: var(--tap);
    padding: 0 var(--space-4);
  }
  .actions :deep(.timer) {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    font-size: var(--text-md);
  }
}
</style>
