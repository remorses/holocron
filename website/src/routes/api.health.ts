import { prisma } from 'db'
import { Route } from './+types/api.health'
import { createHealthLoader } from '@xmorse/deployment-utils/src/health'

async function check() {
  const hash = Math.random().toString(36).slice(2, 10)
  const label = `prisma latency ${hash}`
  console.time(label)
  await prisma.$queryRawUnsafe('SELECT 1')
  console.timeEnd(label)
  return
}
export const loader = createHealthLoader({ check })
export const action = createHealthLoader({ check })
