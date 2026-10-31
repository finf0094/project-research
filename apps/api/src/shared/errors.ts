/** Fastify turns `statusCode` on a thrown error into the HTTP status. */
export class HttpError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export const badRequest = (message: string) => new HttpError(400, message)
export const unauthorized = () => new HttpError(401, 'Not signed in')
export const forbidden = () => new HttpError(403, 'Forbidden')
export const notFound = (what = 'Not found') => new HttpError(404, what)
export const conflict = (message: string) => new HttpError(409, message)
