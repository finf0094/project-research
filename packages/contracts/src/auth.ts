import { z } from 'zod'
import { Id } from './common.ts'

export const Role = z.enum(['student', 'examiner', 'admin'])
export type Role = z.infer<typeof Role>

export const User = z.object({
  id: Id,
  email: z.email(),
  name: z.string(),
  role: Role,
})
export type User = z.infer<typeof User>

export const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
})
export type LoginBody = z.infer<typeof LoginBody>
