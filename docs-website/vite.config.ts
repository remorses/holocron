/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { viteExternalsPlugin } from '@xmorse/deployment-utils/dist/vite-externals-plugin.js'
import { reactRouterHonoServer } from 'react-router-hono-server/dev'
import { defineConfig } from 'vite'
import EnvironmentPlugin from 'vite-plugin-environment'
import tsconfigPaths from 'vite-tsconfig-paths'
import { analyzer } from 'vite-bundle-analyzer'

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

        // rollupOptions: {
        //     output: {
        //         // 👉 put every async chunk that comes from shiki in its own folder
        //         chunkFileNames: (c) =>
        //             /[\\/]shiki[\\/]/.test(c.facadeModuleId ?? '')
        //                 ? 'assets/shiki/[name]-[hash].js'
        //                 : 'assets/[name]-[hash].js',

        //         // 👉 and do the same for the raw grammar JSON that shiki
        //         //     turns into JS modules
        //         assetFileNames: (a) =>
        //             a.name?.endsWith('.tmLanguage.json')
        //                 ? 'assets/shiki/[name]-[hash][extname]'
        //                 : 'assets/[name]-[hash][extname]',
        //     },
        // },
    },

    plugins: [
        // cloudflare({ viteEnvironment: { name: 'ssr' } }),
        EnvironmentPlugin('all', { prefix: 'PUBLIC' }),
        EnvironmentPlugin('all', { prefix: 'NEXT_PUBLIC' }),
        !process.env.VITEST && reactRouterHonoServer(),
        !process.env.VITEST ? reactRouter() : react(),
        tsconfigPaths(),
        viteExternalsPlugin({
            externals: ['pg', 'shiki', 'json-schema-library'],
        }),
        !process.env.VITEST && tailwindcss(),
        process.env.ANALYZE &&
            analyzer({ openAnalyzer: false, analyzerMode: 'static' }),
    ],

    // legacy: {
    //     proxySsrExternalModules: true,
    // },
})
