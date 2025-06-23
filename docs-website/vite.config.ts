/// <reference types="vitest/config" />
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { viteExternalsPlugin } from '@xmorse/deployment-utils/dist/vite-externals-plugin.js'
import { reactRouterHonoServer } from 'react-router-hono-server/dev'
import { defineConfig } from 'vite'
import EnvironmentPlugin from 'vite-plugin-environment'
import tsconfigPaths from 'vite-tsconfig-paths'

const NODE_ENV = JSON.stringify(process.env.NODE_ENV || 'production')

export default defineConfig({
    clearScreen: false,
    define: {
        'process.env.NODE_ENV': NODE_ENV,
    },

    test: {
        pool: 'threads',
        exclude: ['**/dist/**', '**/esm/**', '**/node_modules/**', '**/e2e/**'],
        poolOptions: {
            threads: {
                isolate: false,
            },
        },
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            external: ['shiki'],
        },
    },
    ssr: {
        external: ['shiki'],
    },

    plugins: [
        // cloudflare({ viteEnvironment: { name: 'ssr' } }),
        EnvironmentPlugin('all', { prefix: 'PUBLIC' }),
        EnvironmentPlugin('all', { prefix: 'NEXT_PUBLIC' }),
        !process.env.VITEST && reactRouterHonoServer(),
        !process.env.VITEST && reactRouter(),
        tsconfigPaths(),
        viteExternalsPlugin({ externals: ['pg'] }),
        !process.env.VITEST &&tailwindcss(),
    ],

    legacy: {
        proxySsrExternalModules: true,
    },
})
