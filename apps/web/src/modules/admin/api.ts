import { UserListItem, type NewUser } from '@exam/contracts'
import { z } from 'zod'
import { request } from '@/shared/lib/http'

export const listUsers = () => request('/admin/users', {}, z.array(UserListItem))

export const createUser = (user: NewUser) =>
  request('/admin/users', { method: 'POST', body: user }, UserListItem)
