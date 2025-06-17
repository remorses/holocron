import type { Config } from '@react-router/dev/config'

export default {
    appDirectory: 'src',
    // prerender: ['/', '/defer-example'],
    future: {
        // unstable_viteEnvironmentApi: true,
        unstable_optimizeDeps: true,
    },
} satisfies Config
