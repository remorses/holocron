/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { viteExternalsPlugin, enablePreserveModulesPlugin } from '@xmorse/deployment-utils/dist/vite-externals-plugin.js'
import { reactRouterServerPlugin } from '@xmorse/deployment-utils/dist/react-router.js'
import { defineConfig } from 'vite'
import EnvironmentPlugin from 'vite-plugin-environment'
import { analyzer } from 'vite-bundle-analyzer'

const NODE_ENV = JSON.stringify(process.env.NODE_ENV || 'production')

export default defineConfig({
    clearScreen: false,
    define: {
        'process.env.NODE_ENV': NODE_ENV,
    },
    optimizeDeps: {
        exclude: ['@lancedb/lancedb', 'isolated-vm'],
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
    esbuild: {
        // https://github.com/pacocoursey/next-themes/issues/349
        keepNames: false,
    },
    build: {
        rollupOptions: {
            output: {
                // 👉 put every async chunk that comes from shiki or lucide-react in its own folder
                chunkFileNames: (c) => {
                    const facade = c.facadeModuleId ?? ''
                    if (/[\\/]@shikijs[\\/]/.test(facade)) {
                        return 'assets/shiki/[name]-[hash].js'
                    } else if (/[\\/]lucide-react[\\/]/.test(facade)) {
                        return 'assets/lucide-react/[name]-[hash].js'
                    } else {
                        return 'assets/[name]-[hash].js'
                    }
                },

                assetFileNames: (a) => {
                    if (a.name?.endsWith('.tmLanguage.json')) {
                        return 'assets/shiki/[name]-[hash][extname]'
                    } else if (a.name?.includes('lucide-react')) {
                        return 'assets/lucide-react/[name]-[hash][extname]'
                    } else {
                        return 'assets/[name]-[hash][extname]'
                    }
                },
            },
        },
    },

    plugins: [
        // cloudflare({ viteEnvironment: { name: 'ssr' } }),
        EnvironmentPlugin('all', { prefix: 'PUBLIC' }),
        EnvironmentPlugin('all', { prefix: 'NEXT_PUBLIC' }),

        !process.env.VITEST ? reactRouter() : react(),

        // tsconfigPaths(),
        viteExternalsPlugin({
            externals: [
                'pg',
                'shiki',
                'json-schema-library',
                '@lancedb/lancedb',
                'isolated-vm',

            ],
        }),
        tailwindcss(),
        process.env.ANALYZE &&
            analyzer({ openAnalyzer: false, analyzerMode: 'static' }),
        reactRouterServerPlugin({ port: process.env.PORT || '7777' }),
        enablePreserveModulesPlugin(),
    ],

    // legacy: {
    //     proxySsrExternalModules: true,
    // },
})
