import { defineConfig } from 'vite'
import hono from '@hono/vite-cloudflare-pages'

export default defineConfig({
    plugins: [hono()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    }
})
