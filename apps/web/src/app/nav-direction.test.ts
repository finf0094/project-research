import { describe, expect, it } from 'vitest'
import { navDirection } from './nav-direction'

describe('which way a page slides', () => {
  it('goes deeper from the right and back up from the left', () => {
    expect(navDirection('/attempts/a/result', '/results', false)).toBe('forward')
    expect(navDirection('/results', '/attempts/a/result', false)).toBe('back')
  })

  it('follows the tab order between tabs', () => {
    expect(navDirection('/results', '/exams', false)).toBe('tab-forward')
    expect(navDirection('/exams', '/profile', false)).toBe('tab-back')
    expect(navDirection('/profile', '/calibration', false)).toBe('tab-forward')
  })

  it('treats the system back gesture as back', () => {
    expect(navDirection('/examiner/exams/1', '/examiner/exams/1/monitoring', true)).toBe('back')
  })
})
