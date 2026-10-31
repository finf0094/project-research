import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './test/global-setup.ts',
    // One shared database: test files run one after another.
    fileParallelism: false,
    // The first analysis loads the ONNX models (a few seconds).
    testTimeout: 30_000,
  },
})
