// Shared auth redirect helpers for login and OAuth flows.
// Keeps callback URLs as browser document URLs, never internal RSC transport URLs.

const redirectBase = 'https://holocron.local'

export function normalizeAuthRedirectPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'

  const url = new URL(value, redirectBase)
  url.searchParams.delete('__rsc')

  if (url.pathname === '/index.rsc') {
    url.pathname = '/'
  } else if (url.pathname.endsWith('.rsc')) {
    url.pathname = url.pathname.slice(0, -4)
  }

  return `${url.pathname}${url.search}${url.hash}`
}
