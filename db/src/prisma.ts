import { ITXClientDenyList } from '@prisma/client/runtime/client'
import { PrismaClient, Prisma } from './generated/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

export * from './generated/index.js'

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

export type PrismaTx = Omit<PrismaClient, ITXClientDenyList>
