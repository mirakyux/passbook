import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devServer from '@hono/vite-dev-server'
import build from '@hono/vite-build'
import cloudflareAdapter from '@hono/vite-build/cloudflare-pages'

export default defineConfig(({ mode }) => {
    if (mode === 'client') {
        return {
            plugins: [react()],
            build: {
                outDir: 'dist',
                rollupOptions: {
                    input: './index.html'
                }
            }
        }
    } else {
        return {
            plugins: [
                build({
                    entry: 'src/index.tsx',
                    output: '_worker.js',
                    adapter: cloudflareAdapter
                }),
                devServer({
                    entry: 'src/index.tsx'
                })
            ]
        }
    }
})
