<script setup lang="ts">
import type { AttemptSummary, ExaminerCommandBody } from '@exam/contracts'
import { ref, watch } from 'vue'
import { AppButton, AppDialog } from '@/shared/ui'

/** `error`: why the last command failed, shown inside the dialog (the page behind it is covered). */
const props = defineProps<{ attempt: AttemptSummary | null; sending: boolean; error: string | null }>()
const emit = defineEmits<{ send: [body: ExaminerCommandBody]; close: [] }>()

const message = ref('')
const minutes = ref(10)
const confirmTerminate = ref(false)
watch(
  () => props.attempt,
  () => {
    message.value = ''
    minutes.value = 10
    confirmTerminate.value = false
  },
)
</script>

<template>
  <AppDialog :open="!!attempt" :title="attempt?.student.name ?? ''" @close="emit('close')">
    <div class="sections">
      <p v-if="error" class="error" role="alert">{{ $t(error) }}</p>
      <form
        class="section"
        @submit.prevent="message.trim() && emit('send', { type: 'warn', message: message.trim() })"
      >
        <label for="warn-text">{{ $t('review.command.message') }}</label>
        <textarea
          id="warn-text"
          v-model="message"
          rows="3"
          maxlength="500"
          :placeholder="$t('review.command.messagePlaceholder')"
        />
        <AppButton type="submit" variant="secondary" :disabled="!message.trim() || sending">{{
          $t('review.command.send')
        }}</AppButton>
      </form>
      <form class="section row" @submit.prevent="emit('send', { type: 'extend', minutes })">
        <label for="extend-min">{{ $t('review.command.extend') }}</label>
        <input id="extend-min" v-model.number="minutes" type="number" min="1" max="120" />
        <AppButton type="submit" variant="secondary" :disabled="sending">{{
          $t('review.command.extendSubmit')
        }}</AppButton>
      </form>
      <AppButton v-if="!confirmTerminate" variant="danger" @click="confirmTerminate = true">
        {{ $t('review.command.terminate') }}
      </AppButton>
      <div v-else class="confirm" role="alert">
        <p>{{ $t('review.command.terminateWarning') }}</p>
        <AppButton variant="danger" :disabled="sending" @click="emit('send', { type: 'terminate' })">{{
          $t('review.command.terminateConfirm')
        }}</AppButton>
        <AppButton variant="ghost" @click="confirmTerminate = false">{{ $t('common.cancel') }}</AppButton>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.error {
  color: var(--danger);
}
.sections,
.section {
  display: grid;
  gap: var(--space-3);
}
.sections {
  gap: var(--space-6);
}
.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.row {
  grid-template-columns: 1fr 96px auto;
  align-items: center;
}
label {
  font-weight: 600;
  font-size: var(--text-sm);
}
textarea,
input {
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
</style>
