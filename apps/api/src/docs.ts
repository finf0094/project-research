import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod'

/**
 * OpenAPI description generated from the same Zod contracts that validate requests, so the docs cannot
 * drift from the code. Served at /api/docs (the spec at /api/docs/json). Must be registered before routes.
 */
export async function registerDocs(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'exam API',
        version: '1.0.0',
        description: 'Offline-first online exams with adaptive proctoring.',
      },
      components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'sid' } } },
      security: [{ session: [] }],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })
}
