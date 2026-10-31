import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { testI18n } from '@/shared/i18n/testing'
import { examMessages } from '../messages'
import ChoiceList from './ChoiceList.vue'

const global = { plugins: [testI18n(examMessages)] }
const options = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]

describe('ChoiceList', () => {
  it('toggles options in a multiple-choice question', async () => {
    const wrapper = mount(ChoiceList, { props: { options, multiple: true, modelValue: ['a'] }, global })
    await wrapper.findAll('input')[1]!.trigger('change')
    await wrapper.findAll('input')[0]!.trigger('change')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['a', 'b']], [[]]])
  })

  it('uses native radio buttons for single choice', () => {
    const wrapper = mount(ChoiceList, { props: { options, multiple: false, modelValue: 'b' }, global })
    const inputs = wrapper.findAll('input')
    expect(inputs.map((i) => i.attributes('type'))).toEqual(['radio', 'radio'])
    expect((inputs[1]!.element as HTMLInputElement).checked).toBe(true)
  })
})
