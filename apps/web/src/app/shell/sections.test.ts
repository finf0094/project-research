import { describe, expect, it } from 'vitest'
import { sectionOf, sectionsFor } from './sections'

describe('sections', () => {
  it('gives each role its tabs and a signed-out visitor none', () => {
    const tabs = (role: Parameters<typeof sectionsFor>[0]) => sectionsFor(role).map((s) => s.to)
    expect(tabs('student')).toEqual(['/exams', '/results', '/profile'])
    expect(tabs('examiner')).toEqual(['/examiner', '/calibration', '/profile'])
    expect(tabs('admin')).toEqual(['/admin', '/profile'])
    expect(tabs(null)).toEqual([])
  })

  it('finds the tab of a page', () => {
    expect(sectionOf('/exams/e1/preflight')).toBe('/exams')
    expect(sectionOf('/attempts/a1/result')).toBe('/results')
    expect(sectionOf('/attempts/a1')).toBeNull()
    expect(sectionOf('/examiner/exams/e1/results')).toBe('/examiner')
    expect(sectionOf('/examinerx')).toBeNull()
    expect(sectionOf('/')).toBeNull()
  })
})
