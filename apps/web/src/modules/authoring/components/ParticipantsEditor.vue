<script setup lang="ts">
import { ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { AppButton } from '@/shared/ui'
import { setParticipants } from '../api'

/** Who may take the exam, as student emails; can change at any time, also while the exam runs. */
const props = defineProps<{ examId: string; initial: string[] }>()
/** The saved list, so the page keeps it when this step is left and opened again. */
const emit = defineEmits<{ saved: [participants: string[]] }>()
const text = ref(props.initial.join('\n'))
const count = ref(props.initial.length)
const unknown = ref<string[]>([])
const action = useAction()

const save = () =>
  action.run(async () => {
    const emails = text.value.split(/[\s,;]+/).filter(Boolean)
    const result = await setParticipants(props.examId, emails)
    text.value = result.participants.join('\n')
    count.value = result.participants.length
    unknown.value = result.unknown
    emit('saved', result.participants)
  })
</script>

<template>
  <section class="participants">
    <h2>{{ $t('authoring.participants.title') }}</h2>
    <label>
      <span class="muted">{{ $t('authoring.participants.hint') }}</span>
      <textarea v-model="text" rows="8" spellcheck="false" autocomplete="off" />
    </label>
    <p class="muted">{{ $t('authoring.participants.count', { n: count }) }}</p>
    <p v-if="unknown.length" class="warn" role="status">
      {{ $t('authoring.participants.unknown', { emails: unknown.join(', ') }) }}
    </p>
    <p v-if="action.error.value" class="error" role="alert">{{ $t(action.error.value) }}</p>
    <AppButton variant="secondary" :loading="action.busy.value" @click="save">
      {{ $t('authoring.participants.save') }}
    </AppButton>
  </section>
</template>

<style scoped>
.participants,
label {
  display: grid;
  gap: var(--space-3);
}
label {
  font-size: var(--text-sm);
}
textarea {
  font-family: ui-monospace, monospace;
}
.warn {
  color: var(--warn);
}
.error {
  color: var(--danger);
}
</style>
