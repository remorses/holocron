import { ITXClientDenyList } from '@prisma/client/runtime/client'
import { PrismaClient, Prisma } from './generated/index.js'

export * from './generated/index.js'

const debugQueries = false

export const prisma: PrismaClient =
    (global as any).prisma ||
    new PrismaClient({
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
