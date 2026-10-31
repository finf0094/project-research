import * as ort from 'onnxruntime-node'
import { FRAME_H, FRAME_W } from './media.ts'

/** COCO class ids of the SSD model (1-based label map): things that should not be on the desk. */
const FORBIDDEN = new Set([77, 84]) // cell phone, book
const SCORE = 0.5

/** SSD MobileNet v1: is there a phone or a book in an RGB frame of FRAME_W×FRAME_H? */
export async function loadObjectDetector(path: string) {
  const session = await ort.InferenceSession.create(path, { logSeverityLevel: 3 })
  return async (rgb: Buffer): Promise<boolean> => {
    const input = new ort.Tensor('uint8', new Uint8Array(rgb), [1, FRAME_H, FRAME_W, 3])
    const out = await session.run({ inputs: input })
    const count = (out.num_detections!.data as Float32Array)[0]!
    const classes = out.detection_classes!.data as Float32Array
    const scores = out.detection_scores!.data as Float32Array
    for (let i = 0; i < count; i++) {
      if (scores[i]! >= SCORE && FORBIDDEN.has(Math.round(classes[i]!))) return true
    }
    return false
  }
}
