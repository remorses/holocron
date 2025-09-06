import { ComponentProps } from 'react'
import { Link, useNavigate, useSearchParams, To, NavigateOptions } from 'react-router'
import { withBasePath } from 'docs-website/src/lib/utils'

export function PreservedSearchLink({ to, ...props }: ComponentProps<typeof Link>) {
  const [searchParams] = useSearchParams()
  const currentSearch = searchParams.toString()

  const getPreservedSearchTo = (): To => {
    if (typeof to === 'string') {
      const separator = to.includes('?') ? '&' : '?'
      return currentSearch ? `${to}${separator}${currentSearch}` : to
    }

    if (typeof to === 'object' && to !== null && 'pathname' in to) {
      return {
        ...to,
        search: to.search ? `${to.search}&${currentSearch}` : currentSearch ? `?${currentSearch}` : undefined,
      }
    }

    return to
  }

  return <Link to={getPreservedSearchTo()} {...props} />
}

export const usePreservedNavigate = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentSearch = searchParams.toString()

  return (to: To | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      return navigate(to)
    }

    if (typeof to === 'string') {
      const separator = to.includes('?') ? '&' : '?'
      const preservedTo = currentSearch ? `${to}${separator}${currentSearch}` : to
      return navigate(preservedTo, options)
    }

    if (typeof to === 'object' && to !== null && 'pathname' in to) {
      const preservedTo = {
        ...to,
        search: to.search ? `${to.search}&${currentSearch}` : currentSearch ? `?${currentSearch}` : undefined,
      }
      return navigate(preservedTo, options)
    }

    return navigate(to, options)
  }
}

type GlobalNavigateFunction = (to: string | number, options?: NavigateOptions) => void

export let globalNavigate: GlobalNavigateFunction = (to, options) => {
  if (typeof to === 'number') {
    window.history.go(to)
    return
  }

  const currentSearch = window.location.search
  if (currentSearch && typeof to === 'string' && !to.includes('?')) {
    const separator = '?'
    const url = to.startsWith('/') ? withBasePath(to) : to
    window.location.href = `${url}${separator}${currentSearch.slice(1)}`
  } else {
    const url = typeof to === 'string' && to.startsWith('/') ? withBasePath(to) : to
    window.location.href = url
  }
}

export function setGlobalNavigate(navigateFn: GlobalNavigateFunction) {
  globalNavigate = navigateFn
}
