// Deploy key cookie helpers shared between dashboard.tsx (page handler) and
// dashboard-actions.ts (server actions). Extracted to avoid circular imports.

const DEPLOY_KEY_COOKIE = 'holocron_deploy_key'

export function readDeployKeyCookie(request: Request, projectId: string): string | undefined {
  const cookies = request.headers.get('cookie') ?? ''
  const cookie = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${DEPLOY_KEY_COOKIE}=`))
  const value = cookie?.slice(DEPLOY_KEY_COOKIE.length + 1)
  if (!value) return undefined
  const [cookieProjectId, key] = decodeURIComponent(value).split(':')
  return cookieProjectId === projectId ? key : undefined
}

export function deployKeyCookie({ request, projectId, fullKey }: { request: Request; projectId: string; fullKey: string }): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${DEPLOY_KEY_COOKIE}=${encodeURIComponent(`${projectId}:${fullKey}`)}; Max-Age=120; Path=/dashboard/deploy; HttpOnly; SameSite=Lax${secure}`
}
