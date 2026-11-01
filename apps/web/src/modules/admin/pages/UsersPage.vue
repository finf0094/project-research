<script setup lang="ts">
import type { UserListItem } from '@exam/contracts'
import { onMounted, ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { AppCard, StatusPill } from '@/shared/ui'
import { listUsers } from '../api'
import NewUserForm from '../components/NewUserForm.vue'

/** The administrator's page: every account, and creating new ones (there is no self sign-up). */
const users = ref<UserListItem[]>([])
const load = useAction()
const refresh = () => load.run(async () => (users.value = await listUsers()))
onMounted(refresh)

const TONE = { student: 'off', examiner: 'accent', admin: 'warn' } as const
</script>

<template>
  <main class="page">
    <h1>{{ $t('admin.title') }}</h1>
    <p v-if="load.error.value" class="error" role="alert">{{ $t(load.error.value) }}</p>
    <div class="layout">
      <AppCard class="table-card">
        <!-- Explicit roles: older WebKit forgets table semantics once the phone layout changes `display`. -->
        <table role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">{{ $t('admin.name') }}</th>
              <th scope="col" role="columnheader">Email</th>
              <th scope="col" role="columnheader">{{ $t('admin.role') }}</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <template v-if="!users.length && load.busy.value">
              <tr v-for="n in 6" :key="n" class="ghost" role="row" aria-hidden="true">
                <td colspan="3"><span class="skeleton line" /></td>
              </tr>
            </template>
            <tr v-for="u in users" :key="u.id" role="row">
              <th scope="row" role="rowheader">{{ u.name }}</th>
              <td role="cell" data-label="Email">{{ u.email }}</td>
              <td role="cell" :data-label="$t('admin.role')">
                <StatusPill :tone="TONE[u.role]">{{ $t(`admin.roles.${u.role}`) }}</StatusPill>
              </td>
            </tr>
          </tbody>
        </table>
      </AppCard>
      <AppCard as="aside"><NewUserForm @created="refresh" /></AppCard>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  /* Zero minimum: "Пайдаланушылар" breaks instead of widening the phone page. */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-6);
}
/* One long Kazakh word ("Пайдаланушылар"): a step smaller on phones so it fits whole. */
h1 {
  font-size: clamp(var(--text-xl), 7vw, var(--text-3xl));
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-4);
  align-items: start;
}
table {
  inline-size: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--border);
  text-align: start;
}
thead th {
  color: var(--text-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.error {
  color: var(--danger);
}
tbody tr.ghost td {
  grid-area: 1 / 1 / 3 / -1;
}
.line {
  block-size: 40px;
  border-radius: var(--radius-sm);
}
@media (width < 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Phones: a native list — the name, the email under it in grey, the role on the right. */
@media (width < 600px) {
  .table-card {
    padding: var(--space-2) var(--space-4);
  }
  thead {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  table,
  tbody {
    display: block;
  }
  tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 2px var(--space-3);
    min-block-size: 64px;
    padding-block: var(--space-3);
    border-bottom: 1px solid var(--border);
    &:last-child {
      border-bottom: 0;
    }
  }
  th,
  td {
    padding: 0;
    border: 0;
  }
  td:first-of-type {
    grid-row: 2;
    color: var(--text-2);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  td:last-of-type {
    grid-row: 1 / span 2;
    grid-column: 2;
  }
}
</style>
