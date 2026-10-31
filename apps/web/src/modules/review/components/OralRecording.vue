<script setup lang="ts">
import type { AttemptDetail, CallEvent } from '@exam/contracts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatClock } from '@/shared/lib/format'
import { studentSpans } from '../call-timeline'

/**
 * An oral answer as recorded: the whole answer's audio in one player (merged by the server, including what
 * was said while the call was down), and the student's time on the call with every drop.
 */
const props = defineProps<{
  audio: NonNullable<AttemptDetail['audio']>
  audioUrl: string | null
  call: CallEvent[]
  end: number
}>()
const spans = computed(() => studentSpans(props.call, props.end))
const drops = computed(() => spans.value.filter((s) => s.kind === 'off'))
const total = computed(() => {
  const first = spans.value[0]?.from ?? 0
  return Math.max(1, (spans.value.at(-1)?.to ?? first) - first)
})
const { t } = useI18n()
/** A drop's length: seconds while short, minutes after. */
const length = (ms: number) =>
  ms < 60_000
    ? t('review.oral.seconds', { n: Math.max(1, Math.round(ms / 1000)) })
    : t('review.oral.minutes', { n: Math.round(ms / 60_000) })
</script>

<template>
  <section class="oral">
    <header>
      <h2>{{ $t('review.oral.title') }}</h2>
      <span class="muted note">{{ $t('review.oral.note') }}</span>
    </header>
    <audio v-if="audioUrl" :src="audioUrl" controls preload="metadata" />
    <p v-else class="muted pending" :class="audio.state">{{ $t(`review.oral.audio.${audio.state}`) }}</p>

    <template v-if="spans.length">
      <div class="bar" role="img" :aria-label="$t('review.oral.callBar', { n: drops.length })">
        <span
          v-for="(s, i) in spans"
          :key="i"
          :class="s.kind"
          :style="{ flexGrow: Math.max(1, Math.round(((s.to - s.from) / total) * 1000)) }"
        />
      </div>
      <ul v-if="drops.length" class="drops">
        <li v-for="d in drops" :key="d.from">
          {{
            $t('review.oral.drop', {
              from: formatClock(d.from),
              to: formatClock(d.to),
              length: length(d.to - d.from),
            })
          }}
        </li>
      </ul>
      <p v-else class="muted">{{ $t('review.oral.noDrops') }}</p>
    </template>
    <p v-else class="muted">{{ $t('review.oral.noCall') }}</p>
  </section>
</template>

<style scoped>
.oral {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  h2 {
    font-size: var(--text-lg);
  }
}
.note,
.pending {
  font-size: var(--text-sm);
}
.failed {
  color: var(--warn);
}
audio {
  inline-size: 100%;
}
.bar {
  display: flex;
  gap: 2px;
  block-size: 10px;
  span {
    border-radius: var(--radius-pill);
    &.on {
      background: var(--ok);
    }
    &.off {
      background: var(--warn);
    }
  }
}
.drops {
  display: grid;
  gap: var(--space-1);
  padding: 0;
  color: var(--warn);
  font-size: var(--text-sm);
  font-weight: 600;
  list-style: none;
}
</style>
