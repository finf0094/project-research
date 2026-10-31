// Downloads the ONNX models the worker uses for server-side analysis of recorded fragments.
// They are pinned by SHA-256 so a changed file is never used silently.
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { MODELS, modelPath, sha256 } from '../src/ml/models.ts'

for (const model of Object.values(MODELS)) {
  const path = modelPath(model)
  if (existsSync(path) && sha256(await readFile(path)) === model.sha256) continue
  const response = await fetch(model.url)
  if (!response.ok) throw new Error(`${model.file}: HTTP ${response.status}`)
  const data = Buffer.from(await response.arrayBuffer())
  if (sha256(data) !== model.sha256) throw new Error(`${model.file}: checksum mismatch`)
  await writeFile(path, data)
  console.log(`downloaded ${model.file}`)
}
