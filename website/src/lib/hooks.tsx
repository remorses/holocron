import React, { RefObject, useEffect, useRef } from 'react'
import type { Route as ChatRoute } from 'website/src/routes/org.$orgId.branch.$branchId.chat.$chatId._index'

import { useRouteLoaderData, useBlocker, type Blocker } from 'react-router'
import { toast } from 'sonner'
import { useWebsiteState } from './state'
import { isDocsJson } from 'docs-website/src/lib/utils'

export function useThrowingFn({ fn: fnToWrap, successMessage = '', immediate = false }) {
  const [isLoading, setIsLoading] = React.useState(false)
  useEffect(() => {
    if (immediate) {
      fn()
    }
  }, [immediate])
  const fn = async function wrappedThrowingFn(...args) {
    try {
      setIsLoading(true)
      const result = await fnToWrap(...args)
      if (result?.skipToast) {
        return result
      }
      if (successMessage) {
        toast.success(successMessage)
      }

      return result
    } catch (err) {
      console.error(err)
      // how to handle unreadable errors? simply don't return them from APIs, just return something went wrong
      if (err instanceof Error && !err?.['skipToast']) {
        toast.error(err.message, {})
        return err
      }
      return err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    fn,
  }
}

export function useDebouncedEffect(effect: () => void | (() => void), deps: any[], delay: number) {
  useEffect(() => {
    const handler = setTimeout(() => {
      effect()
    }, delay)

    return () => {
      clearTimeout(handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay])
}

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onAway: (e: MouseEvent | TouchEvent) => void,
) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      onAway(e)
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, onAway])
}

export function useTemporaryState<T>(
  defaultValue: T,
  resetAfter: number,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState(defaultValue)
  const timeoutId = React.useRef<number>(undefined)

  React.useEffect(() => {
    // if the state is not the default value, set a timeout to reset it
    if (state !== defaultValue) {
      timeoutId.current = window.setTimeout(() => {
        setState(defaultValue)
      }, resetAfter)
    }
    // when the component unmounts, clear the timeout
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current)
      }
    }
  }, [state, defaultValue, resetAfter])

  const customSetState: React.Dispatch<React.SetStateAction<T>> = (newState) => {
    // when we set a new state, we should clear the previous timeout
    if (timeoutId.current) {
      clearTimeout(timeoutId.current)
    }
    setState(newState)
  }

  return [state, customSetState]
}

export function useShouldHideBrowser() {
  const chatData = useRouteLoaderData('routes/org.$orgId.branch.$branchId.chat.$chatId._index') as
    | ChatRoute.ComponentProps['loaderData']
    | undefined
  const {  projectPagesFilenames = [] } = chatData || {}
  let hasNoFilesInLoader = !projectPagesFilenames.length
  const filesInDraft = useWebsiteState((x) => x.filesInDraft || {})
  // console.log('filesInDraft', filesInDraft)
  const hasDraftFiles = Object.values(filesInDraft)?.some((x) => {
    if (isDocsJson(x.githubPath)) {
      return false
    }
    return !!x.content
  })
  if (hasDraftFiles) return false
  return hasNoFilesInLoader
}

export function useConfirmLeave({
  when,
  message = 'You have unsaved changes. Are you sure you want to leave?'
}: {
  when: boolean | Parameters<typeof useBlocker>[0]
  message?: string
}) {
  const blocker: Blocker = useBlocker(when);

  // Handle SPA navigation blocking
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmLeave = window.confirm(message)
      if (confirmLeave) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker, message])

  // Native prompt for tab close/reload/new URL (not for SPA links)
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // required to trigger the prompt in modern browsers
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  return blocker;
}
