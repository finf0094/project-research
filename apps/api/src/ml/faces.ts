import * as ort from 'onnxruntime-node'
import { FRAME_H, FRAME_W, halve } from './media.ts'

const W = FRAME_W / 2
const H = FRAME_H / 2
const SCORE = 0.7
const OVERLAP = 0.3

/** UltraFace RFB-320 (input 320×240): counts faces in a decoded RGB frame. */
export async function loadFaceCounter(model: Uint8Array) {
  const session = await ort.InferenceSession.create(model, { logSeverityLevel: 3 })
  return async (frame: Buffer): Promise<number> => {
    const rgb = halve(frame)
    const input = new Float32Array(3 * W * H)
    const plane = W * H
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) input[c * plane + i] = (rgb[i * 3 + c]! - 127) / 128
    }
    const out = await session.run({ input: new ort.Tensor('float32', input, [1, 3, H, W]) })
    const scores = out.scores!.data as Float32Array
    const boxes = out.boxes!.data as Float32Array
    const candidates: Box[] = []
    for (let i = 0; i < scores.length / 2; i++) {
      const score = scores[i * 2 + 1]!
      if (score > SCORE)
        candidates.push({
          score,
          x1: boxes[i * 4]!,
          y1: boxes[i * 4 + 1]!,
          x2: boxes[i * 4 + 2]!,
          y2: boxes[i * 4 + 3]!,
        })
    }
    return suppress(candidates).length
  }
}

interface Box {
  score: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Non-maximum suppression: one box per face. */
export function suppress(boxes: Box[]): Box[] {
  const kept: Box[] = []
  for (const box of boxes.toSorted((a, b) => b.score - a.score)) {
    if (kept.every((k) => iou(k, box) <= OVERLAP)) kept.push(box)
  }
  return kept
}

function iou(a: Box, b: Box) {
  const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1))
  const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1))
  const inter = w * h
  const area = (box: Box) => (box.x2 - box.x1) * (box.y2 - box.y1)
  return inter / (area(a) + area(b) - inter || 1)
}
