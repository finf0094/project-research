<script setup lang="ts">
import type { QuestionInput, QuestionType } from '@exam/contracts'
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, ref, toRaw } from 'vue'
import { newQuestion } from '../draft'
import QuestionEditor from './QuestionEditor.vue'
import QuestionOutline from './QuestionOutline.vue'
import StudentPreview from './StudentPreview.vue'

/**
 * The questions step: the list to move between, the selected question's editor with its tools, and how the
 * student will see it. `issues`: positions of questions that still need fixing.
 */
const model = defineModel<QuestionInput[]>({ required: true })
const selected = defineModel<number>('selected', { required: true })
const props = defineProps<{ disabled: boolean; oral: boolean; issues: Set<number> }>()

// Stable keys that move with their question (not with its position), so the list glides and the editor
// keeps its state per question. A list this workspace did not write (an exam loaded) gets fresh keys.
let keys: string[] = []
let written: QuestionInput[] | null = null
const keyList = computed(() => {
  if (toRaw(model.value) !== written) keys = model.value.map(() => crypto.randomUUID())
  written = toRaw(model.value)
  return keys
})
function write(list: QuestionInput[], nextKeys: string[], select = selected.value) {
  keys = nextKeys
  written = list
  model.value = list
  selected.value = select
  focusEditor()
}
const types = computed(() => (props.oral ? (['text'] as const) : (['single', 'multiple', 'text'] as const)))
const current = computed(() => model.value[selected.value] ?? model.value[0]!)

// Tools that remove or re-create the editor (or get disabled at an end) would drop focus to the page.
const editor = ref<HTMLElement>()
const focusEditor = () =>
  nextTick(() => {
    const active = document.activeElement
    if (!active || active === document.body || (active as HTMLButtonElement).disabled)
      editor.value?.querySelector('textarea')?.focus()
  })

const replace = (q: QuestionInput) =>
  write(
    model.value.map((x, j) => (j === selected.value ? q : x)),
    keys,
  )

const insert = (at: number, q: QuestionInput) =>
  write(
    [...model.value.slice(0, at), q, ...model.value.slice(at)],
    [...keys.slice(0, at), crypto.randomUUID(), ...keys.slice(at)],
    at,
  )
const add = (type: QuestionType) => insert(model.value.length, newQuestion(type))
// A plain copy: the question may hold reactive proxies, which structuredClone cannot copy.
const duplicate = () => insert(selected.value + 1, JSON.parse(JSON.stringify(current.value)) as QuestionInput)

function remove() {
  const i = selected.value
  write(
    model.value.filter((_, j) => j !== i),
    keys.filter((_, j) => j !== i),
    Math.min(i, model.value.length - 2),
  )
}

function move(by: -1 | 1) {
  const i = selected.value
  const swap = <T,>(list: T[]) => {
    const next = [...list]
    ;[next[i], next[i + by]] = [next[i + by]!, next[i]!]
    return next
  }
  write(swap(model.value), swap(keys), i + by)
}
</script>

<template>
  <div class="workspace">
    <QuestionOutline
      class="outline"
      :questions="model"
      :keys="keyList"
      :selected="selected"
      :issues="issues"
      :types="types"
      :disabled="disabled"
      @select="selected = $event"
      @add="add"
    />
    <section ref="editor" class="editor">
      <p v-if="oral" class="muted hint">{{ $t('authoring.questions.oralHint') }}</p>
      <Transition name="swap" mode="out-in">
        <QuestionEditor
          :key="keyList[selected]"
          :model-value="current"
          :index="selected"
          :disabled="disabled"
          :oral="oral"
          @update:model-value="replace"
        >
          <template v-if="!disabled" #tools>
            <button
              type="button"
              :disabled="selected === 0"
              :aria-label="$t('authoring.questions.up')"
              @click="move(-1)"
            >
              <ArrowUp :size="16" />
            </button>
            <button
              type="button"
              :disabled="selected === model.length - 1"
              :aria-label="$t('authoring.questions.down')"
              @click="move(1)"
            >
              <ArrowDown :size="16" />
            </button>
            <button type="button" :aria-label="$t('authoring.questions.duplicate')" @click="duplicate">
              <Copy :size="16" />
            </button>
            <button
              type="button"
              class="danger"
              :disabled="model.length === 1"
              :aria-label="$t('authoring.questions.remove')"
              @click="remove"
            >
              <Trash2 :size="16" />
            </button>
          </template>
        </QuestionEditor>
      </Transition>
    </section>
    <StudentPreview class="preview" :question="current" :index="selected" />
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 280px;
  gap: var(--space-4);
  align-items: start;
}
.outline,
.editor {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.editor {
  display: grid;
  gap: var(--space-3);
}
.hint {
  font-size: var(--text-sm);
}
.preview {
  position: sticky;
  top: var(--space-4);
}
.swap-enter-active,
.swap-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease),
    translate var(--dur-fast) var(--ease);
}
.swap-enter-from {
  opacity: 0;
  translate: 0 8px;
}
.swap-leave-to {
  opacity: 0;
}
@media (width < 1200px) {
  .workspace {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  .preview {
    grid-column: 2;
    position: static;
  }
}
@media (width < 760px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .preview {
    grid-column: auto;
  }
}
</style>
