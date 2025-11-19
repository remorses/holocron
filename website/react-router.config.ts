import type { Config } from '@react-router/dev/config'

export default {
  appDirectory: 'src',
  prerender: ['/'],
  future: {
    // unstable_viteEnvironmentApi: true,
    // unstable_optimizeDeps: true,

    v8_middleware: true,
  },
  serverModuleFormat: 'esm',
  serverBuildFile: '[name].js',
} satisfies Config
