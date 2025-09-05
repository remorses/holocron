import { prisma } from 'db'
import { Route } from './+types/api.health'
import { createHealthLoader } from '@xmorse/deployment-utils/src/health'

async function check() {
    const result = await prisma.$queryRawUnsafe('SELECT 1')
    return
}
export const loader = createHealthLoader({ check })
export const action = createHealthLoader({ check })
