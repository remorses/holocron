import { reactRouter } from '@react-router/dev/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

import EnvironmentPlugin from 'vite-plugin-environment'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({

    clearScreen: false,
    environments: {
        ssr: {
            resolve: {
                // https://github.com/wooorm/decode-named-character-reference/pull/7
                conditions: ['worker'],
            },
            build: {
                rollupOptions: {
                    external: ['shiki'],
                },
            },
        },
    },
    plugins: [
        // cloudflare({ viteEnvironment: { name: 'ssr' } }),
        tailwindcss(),
        reactRouter(),
        tsconfigPaths(),
        EnvironmentPlugin('all', { prefix: 'PUBLIC' }),
        EnvironmentPlugin('all', { prefix: 'NEXT_PUBLIC' }),
        // {
        //     name: 'define-process',
        //     apply(config, env) {
        //         return !env.isSsrBuild
        //     },
        //     config(config) {
        //         return {
        //             define: {
        //                 process: '{}',
        //             },
        //         }
        //     },
        // },
    ],
})
