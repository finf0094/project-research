<script setup lang="ts">
defineProps<{ attemptId: string; signedOut: boolean; saveFailed: boolean; chainBroken: boolean }>()
</script>

<template>
  <div v-if="signedOut || saveFailed || chainBroken" class="notices" role="alert">
    <p v-if="saveFailed" class="notice">
      Не удалось сохранить ответ на устройстве. Освободите место на диске и выберите ответ ещё раз.
    </p>
    <p v-if="signedOut" class="notice">
      Сессия входа закончилась. Ответы сохраняются на устройстве —
      <RouterLink :to="`/login?next=/attempts/${attemptId}`">войдите снова</RouterLink>, чтобы они
      отправились.
    </p>
    <p v-if="chainBroken" class="notice">
      Сервер не смог подтвердить часть сохранённых данных. Продолжайте экзамен — преподаватель проверит работу
      вручную.
    </p>
  </div>
</template>

<style scoped>
.notices {
  display: grid;
  gap: var(--space-2);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
}
</style>
