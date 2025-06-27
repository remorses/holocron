import { createHonoServer } from 'react-router-hono-server/node'

export default await createHonoServer({
    port: Number(process.env.PORT) || 7664,
}) as any
