<script setup lang="ts">
import type { AttemptSummary, ExaminerCommandBody } from '@exam/contracts'
import { ref, watch } from 'vue'
import { AppButton, AppDialog } from '@/shared/ui'

const props = defineProps<{ attempt: AttemptSummary | null }>()
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
      <form
        class="section"
        @submit.prevent="message.trim() && emit('send', { type: 'warn', message: message.trim() })"
      >
        <label for="warn-text">Сообщение студенту</label>
        <textarea
          id="warn-text"
          v-model="message"
          rows="3"
          maxlength="500"
          placeholder="Например: пожалуйста, смотрите на экран"
        />
        <AppButton type="submit" variant="secondary" :disabled="!message.trim()">Отправить</AppButton>
      </form>
      <form class="section row" @submit.prevent="emit('send', { type: 'extend', minutes })">
        <label for="extend-min">Добавить минут</label>
        <input id="extend-min" v-model.number="minutes" type="number" min="1" max="120" />
        <AppButton type="submit" variant="secondary">Продлить</AppButton>
      </form>
      <AppButton v-if="!confirmTerminate" variant="danger" @click="confirmTerminate = true">
        Завершить экзамен студента
      </AppButton>
      <div v-else class="confirm" role="alert">
        <p>Студент больше не сможет отвечать. Уже данные ответы сохранятся.</p>
        <AppButton variant="danger" @click="emit('send', { type: 'terminate' })">Да, завершить</AppButton>
        <AppButton variant="ghost" @click="confirmTerminate = false">Отмена</AppButton>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
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
