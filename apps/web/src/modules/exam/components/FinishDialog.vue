<script setup lang="ts">
import { AppButton, AppDialog } from '@/shared/ui'

defineProps<{ open: boolean; unanswered: number }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <AppDialog :open="open" title="Сдать экзамен?" @close="emit('cancel')">
    <p v-if="unanswered > 0">
      Без ответа осталось вопросов: <strong>{{ unanswered }}</strong
      >. После сдачи изменить ответы будет нельзя.
    </p>
    <p v-else>Вы ответили на все вопросы. После сдачи изменить ответы будет нельзя.</p>
    <p class="muted note">
      Если сейчас нет интернета — ничего страшного: ответы сохранены и отправятся сами.
    </p>
    <template #actions>
      <AppButton variant="secondary" @click="emit('cancel')">Вернуться</AppButton>
      <AppButton @click="emit('confirm')">Сдать</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.note {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
}
</style>
