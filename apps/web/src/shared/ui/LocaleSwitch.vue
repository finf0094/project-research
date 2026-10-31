<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_NAMES, LOCALES, type Locale } from '@/shared/i18n'
import { placeNextToOpener } from '@/shared/lib/popover'

/**
 * The interface language. `pills`: RU / KK / EN side by side (sign-in, preflight). `compact`: a round
 * button with the current code that opens a small native popover (top bars).
 */
withDefaults(defineProps<{ variant?: 'pills' | 'compact' }>(), { variant: 'pills' })
const { locale, t } = useI18n()
const id = useId()

function choose(code: Locale, menu?: HTMLElement | null) {
  locale.value = code
  menu?.hidePopover()
}
</script>

<template>
  <div v-if="variant === 'pills'" class="pills" role="group" :aria-label="t('common.language')">
    <button
      v-for="code in LOCALES"
      :key="code"
      type="button"
      class="pill"
      :lang="code"
      :aria-pressed="locale === code"
      :title="LOCALE_NAMES[code]"
      :aria-label="LOCALE_NAMES[code]"
      @click="choose(code)"
    >
      {{ code.toUpperCase() }}
    </button>
  </div>

  <div v-else class="compact">
    <button
      type="button"
      class="round"
      :popovertarget="id"
      :aria-label="`${t('common.language')}: ${LOCALE_NAMES[locale as Locale]}`"
    >
      {{ locale.toUpperCase() }}
    </button>
    <div :id="id" popover class="menu" @toggle="placeNextToOpener">
      <button
        v-for="code in LOCALES"
        :key="code"
        type="button"
        :aria-pressed="locale === code"
        :lang="code"
        @click="choose(code, ($event.currentTarget as HTMLElement).closest<HTMLElement>('[popover]'))"
      >
        {{ LOCALE_NAMES[code] }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pills {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.pill {
  min-inline-size: 40px;
  min-block-size: 32px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-2);
  font-size: var(--text-xs);
  font-weight: 700;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);

  &[aria-pressed='true'] {
    background: var(--bg);
    color: var(--text);
    box-shadow: var(--shadow-1);
  }
}
.compact {
  position: relative;
}
.round {
  inline-size: 44px;
  block-size: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-1);
  font-size: var(--text-xs);
  font-weight: 700;
  transition: translate var(--dur-fast) var(--ease);
  &:hover {
    translate: 0 -1px;
  }
}
.menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: var(--space-1);
  border: 0;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-2);
  opacity: 0;
  translate: 0 -6px;
  transition:
    opacity var(--dur) var(--ease),
    translate var(--dur) var(--ease),
    display var(--dur) allow-discrete,
    overlay var(--dur) allow-discrete;

  &:popover-open {
    display: grid;
    opacity: 1;
    translate: 0 0;
    @starting-style {
      opacity: 0;
      translate: 0 -6px;
    }
  }
  button {
    padding: var(--space-2) var(--space-4);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: start;
    white-space: nowrap;
    &:hover,
    &[aria-pressed='true'] {
      background: var(--surface-2);
    }
    &[aria-pressed='true'] {
      font-weight: 700;
    }
  }
}
@supports not selector(:popover-open) {
  .menu {
    display: none;
  }
}
</style>
