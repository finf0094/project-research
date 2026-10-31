import { fileURLToPath } from 'node:url'

export interface ModelFile {
  file: string
  url: string
  sha256: string
}

/** Pinned ONNX models (ONNX Model Zoo mirrors on Hugging Face). Fetched by `pnpm models`. */
export const MODELS = {
  /** UltraFace RFB-320: a 1.3 MB face detector, input 320×240. */
  faces: {
    file: 'version-RFB-320.onnx',
    url: 'https://huggingface.co/onnxmodelzoo/version-RFB-320/resolve/main/version-RFB-320.onnx',
    sha256: '34cd7e60aeff28744c657de7a3dc64e872d506741de66987f3426f2b79f88017',
  },
  /** SSD MobileNet v1 trained on COCO: finds phones and books. */
  objects: {
    file: 'ssd_mobilenet_v1_12.onnx',
    url: 'https://huggingface.co/onnxmodelzoo/ssd_mobilenet_v1_12/resolve/main/ssd_mobilenet_v1_12.onnx',
    sha256: 'b8fba5e404077d4048d27fcd1667e85e27e192eb9bf51e696c46a3acd7d21058',
  },
} satisfies Record<string, ModelFile>

export const modelPath = (model: ModelFile) =>
  fileURLToPath(new URL(`../../models/${model.file}`, import.meta.url))
