import { cva, VariantProps } from 'class-variance-authority'
import { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export const badgeVariants = cva('font-mono font-medium', {
    variants: {
        color: {
            green: 'text-green-600 dark:text-green-400',
            yellow: 'text-yellow-600 dark:text-yellow-400',
            red: 'text-red-600 dark:text-red-400',
            blue: 'text-blue-600 dark:text-blue-400',
            orange: 'text-orange-600 dark:text-orange-400',
            purple: 'text-purple-600 dark:text-purple-400',
            pink: 'text-pink-600 dark:text-pink-400',
            teal: 'text-teal-600 dark:text-teal-400',
            cyan: 'text-cyan-600 dark:text-cyan-400',
            gray: 'text-gray-600 dark:text-gray-400',
        },
    },
})


export function Badge({
    className,
    color,
    ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, 'color'> &
    VariantProps<typeof badgeVariants>) {
    return (
        <span
            className={cn(
                badgeVariants({
                    color,
                    className,
                }),
            )}
            {...props}
        >
            {props.children}
        </span>
    )
}
