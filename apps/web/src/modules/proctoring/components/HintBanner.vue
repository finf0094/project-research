<script setup lang="ts">
import {
  CameraOff,
  ClipboardPaste,
  EyeOff,
  Moon,
  PanelTop,
  ScanFace,
  Smartphone,
  Users,
  Volume2,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconTile } from '@/shared/ui'
import { useProctoringStore } from '../proctoring.store'
import type { SignalKind } from '@exam/contracts'

const ICON: Partial<Record<SignalKind, typeof ScanFace>> = {
  face_missing: ScanFace,
  multiple_faces: Users,
  too_dark: Moon,
  noise: Volume2,
  tab_hidden: PanelTop,
  camera_off: CameraOff,
  looking_away: EyeOff,
  object_detected: Smartphone,
  paste: ClipboardPaste,
}

/** A gentle hint from supervision ("we cannot see your face"): a card above the question, never over it. */
const proctoring = useProctoringStore()
const { t } = useI18n()
const hint = computed(() => proctoring.hint)
const text = computed(() => (hint.value ? t(`proctoring.hint.${hint.value}`) : null))
</script>

<template>
  <!-- In the page flow on purpose: a hint must never cover the question. -->
  <div class="slot" role="status" aria-live="polite">
    <Transition name="hint" mode="out-in">
      <p v-if="hint && text" :key="hint" class="hint">
        <IconTile :icon="ICON[hint] ?? ScanFace" tone="peach" />
        {{ text }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.hint {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5) var(--space-3) var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-2);
  font-weight: 600;
}
.slot:empty {
  display: none;
}
.hint-enter-active,
.hint-leave-active {
  transition:
    opacity var(--dur) var(--ease),
    translate var(--dur) var(--ease-spring);
}
.hint-enter-from,
.hint-leave-to {
  opacity: 0;
  translate: 0 -10px;
}
</style>
