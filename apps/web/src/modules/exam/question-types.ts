import { CircleDot, ListChecks, TextCursorInput } from 'lucide-vue-next'

/** One icon per question type, the same on the exam navigation and in the result's breakdown. */
export const TYPE_ICON = { single: CircleDot, multiple: ListChecks, text: TextCursorInput } as const
