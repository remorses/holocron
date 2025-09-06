import { auth } from '../lib/better-auth'

export async function loader({ request }: { request: Request }) {
  return auth.handler(request)
}

export async function action({ request }) {
  return auth.handler(request)
}
