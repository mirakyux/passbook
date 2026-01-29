import { Hono } from 'hono'
import { renderer } from './renderer'

const app = new Hono<{ Bindings: { DB: D1Database } }>()

// Auto-initialize DB tables if they don't exist
const ensureTables = async (db: D1Database) => {
    await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
        db.prepare(`CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            iv TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)
    ]);
}

app.use('*', renderer)

// API Routes
app.post('/api/init', async (c) => {
    const { masterHash } = await c.req.json()
    const { results } = await c.env.DB.prepare('SELECT value FROM settings WHERE key = "master_hash"').all()
    if (results.length > 0) return c.json({ error: 'Already initialized' }, 400)
    await c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
        .bind('master_hash', masterHash)
        .run()
    return c.json({ success: true })
})

app.get('/api/entries', async (c) => {
    const authKey = c.req.header('X-Auth-Key')
    const { results: settings } = await c.env.DB.prepare('SELECT value FROM settings WHERE key = "master_hash"').all()
    if (settings.length === 0) return c.json({ error: 'Not initialized' }, 403)
    if (authKey !== settings[0].value) return c.json({ error: 'Unauthorized' }, 401)

    const { results } = await c.env.DB.prepare('SELECT * FROM entries ORDER BY created_at DESC').all()
    return c.json(results)
})

app.get('/api/status', async (c) => {
    await ensureTables(c.env.DB)
    const { results } = await c.env.DB.prepare('SELECT value FROM settings WHERE key = "master_hash"').all()
    return c.json({ initialized: results.length > 0 })
})

app.post('/api/entries', async (c) => {
    const authKey = c.req.header('X-Auth-Key')
    const { results: settings } = await c.env.DB.prepare('SELECT value FROM settings WHERE key = "master_hash"').all()
    if (authKey !== settings?.[0]?.value) return c.json({ error: 'Unauthorized' }, 401)

    const { id, payload, iv, tag } = await c.req.json()
    await c.env.DB.prepare('INSERT INTO entries (id, payload, iv, tag) VALUES (?, ?, ?, ?)')
        .bind(id, payload, iv, tag)
        .run()
    return c.json({ success: true })
})

// Frontend entry
app.get('/', (c) => {
    return c.render(<div id="root" > </div>)
})

export default app
