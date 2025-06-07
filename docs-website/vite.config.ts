import { reactRouter } from '@react-router/dev/vite'
import EnvironmentPlugin from 'vite-plugin-environment'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    build: {
        rollupOptions: {
            external: ['shiki'],
        },
        minify: false,
    },
    clearScreen: false,
    plugins: [
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
