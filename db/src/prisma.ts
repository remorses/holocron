import { PrismaPg } from '@prisma/adapter-pg'
export * from './generated/models.js'
export * from './generated/client.js'
import { PrismaClient } from './generated/client.js'

const debugQueries = false

export const pgAdapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5,
})

export const prisma: PrismaClient =
    (global as any).prisma ||
    new PrismaClient({
        adapter: pgAdapter,

        log: debugQueries
            ? [
                  {
                      emit: 'stdout',
                      level: 'query',
                  },
              ]
            : undefined,
    })

if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma
