import { useFetchers, useNavigation } from 'react-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { useMemo, useEffect } from 'react'

export function useNProgress() {
    const transition = useNavigation()
    const fetchers = useFetchers()

    /**
     * This gets the state of every fetcher active on the app and combine it with
     * the state of the global transition (Link and Form), then use them to
     * determine if the app is idle or if it's loading.
     * Here we consider both loading and submitting as loading.
     */
    const state = useMemo<'idle' | 'loading'>(
        function getGlobalState() {
            const states = [
                transition.state,
                ...fetchers.map((fetcher) => fetcher.state),
            ]
            if (states.every((state) => state === 'idle')) return 'idle'
            return 'loading'
        },
        [transition.state, fetchers],
    )

    useEffect(() => {
        NProgress.configure({ showSpinner: false })
        if (state === 'loading') NProgress.start()
        // when the state is idle then we can to complete the progress bar
        if (state === 'idle') NProgress.done()
    }, [state])
}
