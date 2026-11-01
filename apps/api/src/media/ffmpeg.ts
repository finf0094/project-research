import { spawn } from 'node:child_process'
import type { Readable } from 'node:stream'

/**
 * Runs ffmpeg on one input (in memory, or streamed so a long one is never held) and returns its output. Only pipes are allowed (no demuxer may open
 * files or URLs named inside an upload); output above `maxBytes` or a run longer than `timeoutMs` is killed,
 * so a crafted file cannot exhaust memory or time. `inputArgs` describe the input (e.g. raw PCM's format).
 */
export function ffmpeg(
  args: string[],
  input: Buffer | Readable,
  limits: { maxBytes: number; timeoutMs: number },
  inputArgs: string[] = [],
  /** Where the output goes: stdout by default; a file path when the format needs a seekable output. */
  output = 'pipe:1',
) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        ...['-loglevel', 'error', '-nostdin', '-threads', '1'],
        ...['-protocol_whitelist', 'pipe', ...inputArgs, '-i', 'pipe:0'],
        ...args,
        output,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const out: Buffer[] = []
    let size = 0
    let stderr = ''
    // A streamed input is closed however ffmpeg ends, so its file handle never outlives the run.
    const closeInput = () => Buffer.isBuffer(input) || input.destroy()
    const fail = (error: Error) => {
      child.kill('SIGKILL')
      closeInput()
      reject(error)
    }
    const timer = setTimeout(() => fail(new FfmpegTimeout()), limits.timeoutMs)
    child.stdout.on('data', (d: Buffer) => {
      size += d.length
      if (size > limits.maxBytes) return fail(new Error('ffmpeg output too large'))
      out.push(d)
    })
    child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d).slice(-2000)))
    child.on('error', (error) => (clearTimeout(timer), closeInput(), reject(error)))
    child.on('close', (code) => {
      clearTimeout(timer)
      closeInput()
      if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`))
      resolve(Buffer.concat(out))
    })
    child.stdin.on('error', () => undefined) // ffmpeg may close stdin early on a broken file; 'close' reports it
    if (Buffer.isBuffer(input)) child.stdin.end(input)
    else input.on('error', (error) => fail(error)).pipe(child.stdin)
  })
}

/** ffmpeg did not finish in time: the machine was busy, not the input broken, so it is worth another try. */
export class FfmpegTimeout extends Error {
  constructor() {
    super('ffmpeg timed out')
  }
}
