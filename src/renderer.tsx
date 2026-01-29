import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }) => {
    return (
        <html>
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link href="/src/index.css" rel="stylesheet" />
                {title ? <title>{title}</title> : <title>Passbook</title>}
            </head>
            <body className="bg-slate-950 text-slate-100 min-h-screen">
                <div id="root">{children}</div>
                <script type="module" src="/src/client.tsx"></script>
            </body>
        </html>
    )
})
