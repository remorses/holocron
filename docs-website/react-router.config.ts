import type { Config } from '@react-router/dev/config'

export default {
    ssr: true,
    appDirectory: 'src',
    basename: process.env.BASE_PATH,

    future: {
        unstable_optimizeDeps: true,
    },
} satisfies Config
