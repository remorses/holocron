import type { Config } from '@react-router/dev/config'

export default {
    ssr: true,
    appDirectory: 'src',
    basename: process.env.PUBLIC_BASE_PATH || '/',
    future: {
        unstable_optimizeDeps: true,
        unstable_middleware: true,
    },
    serverBuildFile: '[name].js',
} satisfies Config
