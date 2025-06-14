import { prisma } from 'db'
import { Route } from './+types/api.health'

export const loader = async ({ context }: Route.LoaderArgs) => {
    const result = await prisma.$queryRawUnsafe('SELECT 1')
    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
    })
}
export const action = async ({ context }: Route.ActionArgs) => {
    const result = await prisma.$queryRawUnsafe('SELECT 1')
    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
    })
}
