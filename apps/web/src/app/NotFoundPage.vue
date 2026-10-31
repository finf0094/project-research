<script setup lang="ts">
import { AppButton, AppCard } from '@/shared/ui'
</script>

<template>
  <main class="page">
    <AppCard class="card">
      <p class="code display" aria-hidden="true">404</p>
      <h1>Такой страницы нет</h1>
      <p class="muted">Возможно, ссылка устарела. Начните с главной страницы.</p>
      <AppButton @click="$router.replace('/')">На главную</AppButton>
    </AppCard>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-4);
}
.card {
  display: grid;
  gap: var(--space-4);
  justify-items: start;
  max-width: 480px;
}
.code {
  font-size: 5rem;
  font-weight: 700;
  color: var(--accent);
}
</style>
