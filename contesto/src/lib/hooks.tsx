import React, { useEffect } from 'react'

export function useThrowingFn({
    fn: fnToWrap,
    successMessage = '',
    immediate = false,
}: {
    fn: (...args: any[]) => Promise<any>
    successMessage?: string
    immediate?: boolean
}) {
    const [isLoading, setIsLoading] = React.useState(false)
    useEffect(() => {
        if (immediate) {
            fn()
        }
    }, [immediate])
    const fn = async function wrappedThrowingFn(...args: any[]) {
        try {
            setIsLoading(true)
            const result = await fnToWrap(...args)
            if (result?.skipToast) {
                return result
            }
            if (successMessage) {
                // In contesto, we don't have toast, so just log it
                console.log(successMessage)
            }

            return result
        } catch (err) {
            console.error(err)
            // In contesto, we don't have toast, so just return the error
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