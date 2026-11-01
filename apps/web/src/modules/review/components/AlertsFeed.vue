<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Layers, ShieldCheck, Wifi, WifiOff } from 'lucide-vue-next'
import type { Alert, AlertKind } from '../alerts'
import { IconTile } from '@/shared/ui'

/** The proctor's feed: only what needs attention, newest on top, sliding in as it happens. */
defineProps<{ alerts: Alert[]; now: number }>()
defineEmits<{ open: [attemptId: string] }>()

/** "12 seconds ago", then minutes: [message key, count]. */
function ago(at: number, now: number): [string, number] {
  const seconds = Math.max(1, Math.round((now - at) / 1000))
  return seconds < 60
    ? ['hub.monitoring.secondsAgo', seconds]
    : ['hub.monitoring.minutesAgo', Math.floor(seconds / 60)]
}
const LOOK = {
  submitted: { icon: CheckCircle2, tone: 'ok' },
  offline: { icon: WifiOff, tone: 'ink' },
  online: { icon: Wifi, tone: 'ink' },
  risk: { icon: AlertTriangle, tone: 'danger' },
  ready: { icon: ShieldCheck, tone: 'ink' },
  more: { icon: Layers, tone: 'ink' },
} as const satisfies Record<AlertKind, unknown>
</script>

<template>
  <section class="feed">
    <header>
      <h2>{{ $t('hub.monitoring.alerts') }}</h2>
      <span class="note">{{ $t('hub.monitoring.alertsNote') }}</span>
    </header>
    <p v-if="!alerts.length" class="empty">{{ $t('hub.monitoring.noAlerts') }}</p>
    <!-- A log: new alerts are announced; the ticking "ago" is hidden from it so it is not re-read. -->
    <TransitionGroup tag="ul" name="list" role="log" aria-live="polite" aria-relevant="additions">
      <li v-for="alert in alerts" :key="alert.id">
        <!-- Folded by the attention budget: a quiet line, nothing to open (the list shows every change). -->
        <component
          :is="alert.kind === 'more' ? 'div' : 'button'"
          :type="alert.kind === 'more' ? undefined : 'button'"
          class="item"
          :class="{ folded: alert.kind === 'more' }"
          @click="alert.kind !== 'more' && $emit('open', alert.attemptId)"
        >
          <IconTile :icon="LOOK[alert.kind].icon" :tone="LOOK[alert.kind].tone" />
          <span>
            <span class="text">{{
              $t(
                `hub.monitoring.alert.${alert.kind}`,
                { name: alert.name, n: alert.count ?? 0 },
                alert.count ?? 0,
              )
            }}</span>
            <span class="when" aria-hidden="true">{{ $t(...ago(alert.at, now)) }}</span>
          </span>
        </component>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.feed {
  position: relative;
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}
h2 {
  font-size: var(--text-lg);
}
.note,
.empty,
.when {
  color: var(--on-ink-2);
  font-size: var(--text-xs);
}
ul {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.item {
  display: flex;
  gap: var(--space-3);
  inline-size: 100%;
  padding: var(--space-3);
  border: 0;
  border-radius: var(--radius);
  background: var(--on-ink-tint);
  color: inherit;
  text-align: start;
  transition: background-color var(--dur) var(--ease);
  &:hover {
    background: var(--on-ink-tint-2);
  }
  > span {
    display: grid;
    gap: 2px;
  }
}
.folded {
  opacity: 0.75;
  cursor: default;
  &:hover {
    background: var(--on-ink-tint);
  }
}
.text {
  font-size: var(--text-sm);
  font-weight: 600;
}
</style>
