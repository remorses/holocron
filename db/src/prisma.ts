import { PrismaPg } from '@prisma/adapter-pg'
export * from '@prisma/client'
import { PrismaClient } from '@prisma/client'

const debugQueries = false

export const pgAdapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
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
