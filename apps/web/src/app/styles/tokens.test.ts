import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../..')
const files = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => /\.(vue|css)$/.test(f))
  .map((f) => readFileSync(join(SRC, f), 'utf8'))

/**
 * A misspelt token (`var(--space-10)`) silently drops the whole declaration in the browser. Every
 * `var(--x)` must be defined in a stylesheet or set inline from a component (`'--x': …`).
 */
describe('design tokens', () => {
  it('are all defined where they are used', () => {
    const source = files.join('\n')
    const defined = new Set(
      [...source.matchAll(/(--[a-z0-9-]+)\s*:|'(--[a-z0-9-]+)'/g)].map((m) => m[1] ?? m[2]),
    )
    const used = new Set([...source.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))
    expect([...used].filter((name) => !defined.has(name))).toEqual([])
  })
})
