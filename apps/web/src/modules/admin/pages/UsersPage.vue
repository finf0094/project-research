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
      <AppCard>
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
  gap: var(--space-6);
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
@media (width < 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Phones: the name on top, then the email and the role, each with its column name for the eye. */
@media (width < 600px) {
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
    gap: var(--space-2) var(--space-3);
    padding-block: var(--space-3);
    border-bottom: 1px solid var(--border);
  }
  th,
  td {
    padding: 0;
    border: 0;
  }
  th {
    grid-column: 1 / -1;
  }
  td {
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
    &::before {
      content: attr(data-label);
      content: attr(data-label) / '';
      display: block;
      margin-block-end: var(--space-1);
      color: var(--text-2);
      font-size: var(--text-xs);
      font-weight: 600;
    }
  }
}
</style>
