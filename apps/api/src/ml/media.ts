import { spawn } from 'node:child_process'

export const FRAME_W = 320
export const FRAME_H = 240

/** Decodes a recorded chunk into RGB frames (FRAME_W×FRAME_H, `fps` per second) with ffmpeg. */
export function extractFrames(video: Buffer, fps = 1): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-vf',
        `fps=${fps},scale=${FRAME_W}:${FRAME_H}`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const out: Buffer[] = []
    let stderr = ''
    ffmpeg.stdout.on('data', (d: Buffer) => out.push(d))
    ffmpeg.stderr.on('data', (d: Buffer) => (stderr += d))
    ffmpeg.on('error', reject)
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`))
      const all = Buffer.concat(out)
      const size = FRAME_W * FRAME_H * 3
      const frames: Buffer[] = []
      for (let offset = 0; offset + size <= all.length; offset += size)
        frames.push(all.subarray(offset, offset + size))
      resolve(frames)
    })
    ffmpeg.stdin.on('error', () => undefined) // ffmpeg may close stdin early on a broken file; 'close' reports it
    ffmpeg.stdin.end(video)
  })
}
