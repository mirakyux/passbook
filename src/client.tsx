import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'

// Polyfills for browser
if (typeof window !== 'undefined') {
    window.Buffer = Buffer
    window.process = { env: {} } as any
}

import App from './App'
import './index.css'

const root = document.getElementById('root')
if (root) {
    try {
        createRoot(root).render(<App />)
    } catch (err) {
        console.error('React Render Error:', err)
        root.innerHTML = `<div style="padding: 20px; color: white; background: #1a1a1a; font-family: monospace;"><h1>Render Error</h1><pre>${err}</pre></div>`
    }
}

window.onerror = (msg, url, lineNo, columnNo, error) => {
    console.error('Global Error:', msg, error)
    const rootEl = document.getElementById('root')
    if (rootEl) {
        rootEl.innerHTML = `<div style="padding: 20px; color: white; background: #1a1a1a; font-family: monospace;"><h1>Global Error</h1><p>${msg}</p><pre>${error?.stack || ''}</pre></div>`
    }
    return false
}
