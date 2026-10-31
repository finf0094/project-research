import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/** Where recorded fragments live. The filesystem version serves development; production swaps in S3/MinIO. */
export interface BlobStorage {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer | null>
  remove(key: string): Promise<void>
}

export function fsStorage(root: string): BlobStorage {
  const base = resolve(root)
  const path = (key: string) => {
    const full = resolve(join(base, key))
    if (!full.startsWith(base + '/')) throw new Error(`Invalid storage key: ${key}`)
    return full
  }
  return {
    async put(key, data) {
      await mkdir(dirname(path(key)), { recursive: true })
      await writeFile(path(key), data)
    },
    async get(key) {
      try {
        return await readFile(path(key))
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw e
      }
    },
    async remove(key) {
      await rm(path(key), { force: true })
    },
  }
}

/** Storage key of a recorded chunk. */
export const blobKey = (attemptId: string, hash: string) => `${attemptId}/${hash}`
