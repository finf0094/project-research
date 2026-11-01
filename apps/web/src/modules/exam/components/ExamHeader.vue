<script setup lang="ts">
import { Check, Maximize, Minimize, RefreshCw, WifiOff } from 'lucide-vue-next'
import { computed } from 'vue'
import { SyncStatusBadge, useSyncStore } from '@/modules/offline'
import { useFullscreen } from '@/shared/lib/use-fullscreen'
import { AppButton, AppLogo } from '@/shared/ui'
import ExamTimer from './ExamTimer.vue'

/** The exam's bar: what and where, save state (an icon per state), focus mode, time left and submitting. */
defineProps<{ title: string; step: string; remainingMs: number; finishing: boolean }>()
defineEmits<{ finish: [] }>()
const focus = useFullscreen()
const sync = useSyncStore()
const short = computed(() => {
  const { connection, pendingEvents } = sync.status
  if (connection === 'offline') return { tone: 'off', icon: WifiOff, text: 'offline' }
  if (pendingEvents > 0) return { tone: 'warn', icon: RefreshCw, text: 'sending' }
  return { tone: 'ok', icon: Check, text: 'saved' }
})
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
    <!-- The badge above stays the live region for screen readers; this is its visible short form. -->
    <span class="sync-short" :class="short.tone" aria-hidden="true">
      <component :is="short.icon" :size="14" /><span class="sync-word">{{
        $t(`exam.header.sync.${short.text}`)
      }}</span>
    </span>
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
  /* Only on the narrowest phones would the button squeeze the title; everywhere else it stays. */
  @media (width < 480px) {
    display: none;
  }
  @media (width < 700px) {
    .focus-label {
      position: absolute;
      clip-path: inset(50%);
    }
  }
}
.sync-short {
  display: none;
  align-items: center;
  gap: var(--space-1);
  padding: 4px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  &.ok {
    background: var(--ok-tint);
    color: var(--ok);
  }
  &.warn {
    background: var(--warn-tint);
    color: var(--warn);
  }
  &.off {
    background: var(--off-tint);
    color: var(--off);
  }
  /* Narrowest phones: the distinct icon stays, the word goes, so the exam's name stays readable. */
  @media (width < 480px) {
    padding: 6px;
    .sync-word {
      display: none;
    }
  }
}
.actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
/* Phones held upright: one compact pinned row (title, timer, submit) stays in reach while the question
   scrolls. Not in landscape, where it would eat a third of the screen. base.css keeps focus clear of it. */
@media (width < 900px) and (height >= 600px) {
  .header {
    min-block-size: var(--exam-bar-height);
    position: sticky;
    inset-block-start: max(var(--space-2), env(safe-area-inset-top));
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
  /* Two short lines rather than one ellipsis that leaves only the first letter on a phone. */
  .name {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    font-size: var(--text-sm);
    line-height: 1.25;
  }
  /* Both stay for screen readers; the badge's full text gives way to its short form. */
  .step,
  .badge {
    position: absolute;
    clip-path: inset(50%);
  }
  .sync-short {
    display: inline-flex;
  }
  .actions {
    gap: var(--space-2);
  }
  .focus,
  .actions .submit,
  .actions :deep(.timer) {
    block-size: var(--tap);
    min-height: var(--tap);
    padding: 0 var(--space-3);
  }
  .actions :deep(.timer) {
    font-size: var(--text-md);
  }
}
</style>
