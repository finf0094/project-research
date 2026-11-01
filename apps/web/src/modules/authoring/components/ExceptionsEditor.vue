<script setup lang="ts">
import type { SignalKind } from '@exam/contracts'
import { computed, ref } from 'vue'
import { AppButton } from '@/shared/ui'
import type { useExceptions } from '../use-exceptions'

/**
 * Section 25.3, individual exceptions: for a student with special needs, signals that are not watched (the
 * device raises no hint, the server sets no marker). Saved as soon as a box is ticked.
 */
const props = defineProps<{ participants: string[]; exceptions: ReturnType<typeof useExceptions> }>()
const SIGNALS: SignalKind[] = [
  'face_missing',
  'looking_away',
  'noise',
  'multiple_faces',
  'tab_hidden',
  'object_detected',
  'off_center',
  'copy',
  'second_screen',
  'mic_off',
  'paste',
]

// Only students given arrangements are listed (plus one just picked): everyone else is watched in full.
const added = ref<string[]>([])
const listed = computed(() =>
  props.participants.filter((e) => added.value.includes(e) || props.exceptions.disabledFor(e).length),
)
const others = computed(() => props.participants.filter((e) => !listed.value.includes(e)))
const pick = ref('')
function add() {
  if (pick.value) added.value = [...added.value, pick.value]
  pick.value = ''
}
</script>

<template>
  <section class="exceptions">
    <h3>{{ $t('authoring.exceptions.title') }}</h3>
    <p class="muted">{{ $t('authoring.exceptions.hint') }}</p>
    <p v-if="!participants.length" class="muted">{{ $t('authoring.exceptions.none') }}</p>
    <p v-else-if="!listed.length" class="muted">{{ $t('authoring.exceptions.empty') }}</p>
    <details v-for="email in listed" :key="email" class="student" :open="added.includes(email)">
      <summary>
        {{ email }}
        <span v-if="exceptions.disabledFor(email).length" class="count">{{
          $t('authoring.exceptions.count', { n: exceptions.disabledFor(email).length })
        }}</span>
      </summary>
      <fieldset :disabled="exceptions.saving.value.has(email)">
        <legend class="visually-hidden">{{ $t('authoring.exceptions.for', { email }) }}</legend>
        <label v-for="signal in SIGNALS" :key="signal">
          <input
            type="checkbox"
            :checked="exceptions.disabledFor(email).includes(signal)"
            @change="exceptions.toggle(email, signal, ($event.target as HTMLInputElement).checked)"
          />
          {{ $t(`review.marker.${signal}`) }}
        </label>
      </fieldset>
      <p v-if="exceptions.failed.value.has(email)" class="error" role="alert">
        {{ $t(exceptions.failed.value.get(email)!) }}
      </p>
    </details>
    <div v-if="others.length" class="add">
      <select v-model="pick" :aria-label="$t('authoring.exceptions.pick')">
        <option value="" disabled>{{ $t('authoring.exceptions.pick') }}</option>
        <option v-for="email in others" :key="email" :value="email">{{ email }}</option>
      </select>
      <AppButton variant="secondary" :disabled="!pick" @click="add">{{
        $t('authoring.exceptions.add')
      }}</AppButton>
    </div>
  </section>
</template>

<style scoped>
.exceptions {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
  h3 {
    font-size: var(--text-md);
  }
}
.student {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
  summary {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    cursor: pointer;
    font-weight: 600;
  }
}
.count {
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--warn-tint);
  color: var(--warn);
  font-size: var(--text-xs);
}
fieldset {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  border: 0;
  label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--text-sm);
  }
  input {
    accent-color: var(--accent);
  }
}
.error {
  color: var(--danger);
}
.add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  select {
    flex: 1 1 220px;
  }
}
</style>
