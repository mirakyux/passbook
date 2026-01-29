import { useState, useEffect } from 'react'
import { Lock, Plus, Shield, ShieldCheck, Trash2, Key, Sidebar, LogOut, Copy, ExternalLink, Search, Clock, QrCode } from 'lucide-react'
import * as vaultCrypto from './crypto'
import { authenticator } from 'otplib'
import jsQR from 'jsqr'

// Types
interface Entry {
    id: string;
    title: string;
    username: string;
    password?: string;
    url?: string;
    otpSecret?: string;
    notes?: string;
    totp?: string; // Runtime generated
}

interface EncryptedEntry {
    id: string;
    payload: string;
    iv: string;
    tag: string;
}

export default function App() {
    const [isLocked, setIsLocked] = useState(true)
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
    const [password, setPassword] = useState('')
    const [authKey, setAuthKey] = useState('')
    const [entries, setEntries] = useState<Entry[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState<Entry | null>(null)
    const [now, setNow] = useState(Date.now())
    const [isPersistent, setIsPersistent] = useState(true) // Default to remember

    // Check for stored password and system status on mount
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/status')
                const data = await res.json()
                setIsInitialized(data.initialized)
            } catch (e) {
                console.error('Failed to check status', e)
                setIsInitialized(true) // Fallback to assumed initialized
            }
        }
        checkStatus()

        const stored = localStorage.getItem('pb_master')
        if (stored) {
            setPassword(stored)
            doUnlock(stored)
        }
    }, [])

    useEffect(() => {
        if (!isLocked && password && isPersistent) {
            localStorage.setItem('pb_master', password)
        }
    }, [isLocked, password, isPersistent])

    // Update TOTP every second
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Derived State
    const filteredEntries = entries.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.username.toLowerCase().includes(search.toLowerCase())
    )

    const handleUnlock = () => doUnlock(password)

    const doUnlock = async (passToUse: string) => {
        if (!passToUse) return
        setLoading(true)
        try {
            const key = await vaultCrypto.getAuthKey(passToUse)
            setAuthKey(key)
            // Fetch entries
            const res = await fetch('/api/entries', {
                headers: { 'X-Auth-Key': key }
            })
            if (res.ok) {
                const data: EncryptedEntry[] = await res.json()
                const decrypted = await Promise.all(data.map(async item => {
                    const content = await vaultCrypto.decrypt(item, passToUse)
                    return { id: item.id, ...content }
                }))
                setEntries(decrypted)
                setIsLocked(false)
            } else if (res.status === 403) {
                // Not initialized? Treat this as first run
                const init = await fetch('/api/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ masterHash: key })
                })
                if (init.ok) {
                    setEntries([])
                    setIsLocked(false)
                }
            } else {
                alert('Invalid password or system error')
            }
        } catch (e) {
            console.error(e)
            alert('Failed to unlock vault')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (entry: Partial<Entry>) => {
        setLoading(true)
        try {
            const id = editing?.id || window.crypto.randomUUID()
            const encrypted = await vaultCrypto.encrypt(entry, password)
            const res = await fetch(`/api/entries${editing ? `/${id}` : ''}`, {
                method: editing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Key': authKey
                },
                body: JSON.stringify({ id, ...encrypted })
            })
            if (res.ok) {
                // Refresh list or update local state
                const newEntry = { id, ...entry } as Entry
                if (editing) {
                    setEntries(entries.map(e => e.id === id ? newEntry : e))
                } else {
                    setEntries([newEntry, ...entries])
                }
                setShowAdd(false)
                setEditing(null)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return
        setLoading(true)
        try {
            const res = await fetch(`/api/entries/${id}`, {
                method: 'DELETE',
                headers: { 'X-Auth-Key': authKey }
            })
            if (res.ok) {
                setEntries(prev => prev.filter(e => e.id !== id))
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) return
                ctx.drawImage(img, 0, 0)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                const code = jsQR(imageData.data, imageData.width, imageData.height)

                if (code) {
                    try {
                        const url = new URL(code.data)
                        const secret = url.searchParams.get('secret')
                        const label = decodeURIComponent(url.pathname.split(':').pop() || '')
                        const issuer = url.searchParams.get('issuer')

                        if (secret) {
                            const cleanSecret = secret.replace(/\s/g, '').toUpperCase()
                            setEditing(prev => ({
                                ...prev!,
                                otpSecret: cleanSecret,
                                title: prev?.title || issuer || '',
                                username: prev?.username || label || ''
                            }))
                        } else {
                            alert('No secret found in QR code')
                        }
                    } catch (err) {
                        alert('Invalid QR code format')
                    }
                } else {
                    alert('Could not detect QR code in image')
                }
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    if (isLocked) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-md p-8 glass-card">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 rounded-full bg-blue-500/20">
                            {isInitialized === false ? <ShieldCheck size={48} className="text-blue-400" /> : <Lock size={48} className="text-blue-400" />}
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-center mb-2">Passbook</h1>
                    <p className="text-slate-400 text-center mb-8">
                        {isInitialized === false ? 'Set your master password to start' : 'Enter your master password to unlock'}
                    </p>
                    <input
                        type="password"
                        placeholder={isInitialized === false ? 'Create Master Password' : 'Master Password'}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                    />
                    <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setIsPersistent(!isPersistent)}>
                        <div className={`w-5 h-5 rounded border ${isPersistent ? 'bg-blue-600 border-blue-600' : 'border-slate-700'} flex items-center justify-center transition-all`}>
                            {isPersistent && <ShieldCheck size={14} className="text-white" />}
                        </div>
                        <span className="text-sm text-slate-400">Remember password on this device</span>
                    </div>
                    <button
                        onClick={handleUnlock}
                        disabled={loading || isInitialized === null}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                    >
                        {loading ? (isInitialized === false ? 'Initializing...' : 'Decrypting...') : (isInitialized === false ? 'Setup Vault' : 'Unlock Vault')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-slate-800 p-4 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="text-blue-400" />
                        <span className="font-bold text-xl">Vault</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                localStorage.removeItem('pb_master');
                                setIsLocked(true);
                                setPassword('');
                                setEntries([]);
                            }}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                            title="Logout and clear storage"
                        >
                            <LogOut size={20} />
                        </button>
                        <button
                            onClick={() => {
                                setEditing({ id: '', title: '', username: '', password: '', url: '', otpSecret: '' });
                                setShowAdd(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-all"
                        >
                            <Plus size={20} />
                            <span>Add Entry</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
                <div className="relative mb-8">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search your vault..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {filteredEntries.map(entry => (
                        <div key={entry.id} className="p-6 glass-card border border-slate-800 hover:border-blue-500/30 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg">{entry.title}</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditing(entry); setShowAdd(true); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><Key size={16} /></button>
                                    <button className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Username</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-300">{entry.username}</span>
                                        <button onClick={() => navigator.clipboard.writeText(entry.username)} className="text-blue-400 hover:text-blue-300"><Copy size={14} /></button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Password</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-300">••••••••</span>
                                        <button onClick={() => entry.password && navigator.clipboard.writeText(entry.password)} className="text-blue-400 hover:text-blue-300"><Copy size={14} /></button>
                                    </div>
                                </div>
                                {entry.otpSecret && (
                                    <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase text-blue-400 font-bold tracking-wider">2FA Code</span>
                                            <span className="text-2xl font-mono text-blue-100 tracking-[0.2em]">
                                                {(() => {
                                                    try {
                                                        const clean = entry.otpSecret?.replace(/\s/g, '').toUpperCase()
                                                        return clean ? authenticator.generate(clean) : ''
                                                    } catch (e) {
                                                        console.error('TOTP Error:', e)
                                                        return 'INVALID'
                                                    }
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1 text-[10px] text-blue-400">
                                                <Clock size={10} />
                                                <span>{30 - Math.floor((now / 1000) % 30)}s</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    try {
                                                        const clean = entry.otpSecret?.replace(/\s/g, '').toUpperCase()
                                                        if (clean) navigator.clipboard.writeText(authenticator.generate(clean))
                                                    } catch (e) { }
                                                }}
                                                className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {entry.url && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">URL</span>
                                        <a href={entry.url} target="_blank" className="text-blue-400 hover:underline flex items-center gap-1">
                                            {entry.url.replace(/^https?:\/\//, '')} <ExternalLink size={12} />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Modals: Simple inline for now */}
            {(showAdd || editing) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-lg glass-card p-8 border border-slate-700">
                        <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Entry' : 'Add New Entry'}</h2>
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            handleSave(editing!)
                        }}>
                            <div className="space-y-4">
                                <input
                                    value={editing?.title || ''}
                                    onChange={e => setEditing({ ...editing!, title: e.target.value })}
                                    placeholder="Title (e.g. Google, GitHub)"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                                    required
                                />
                                <input
                                    value={editing?.username || ''}
                                    onChange={e => setEditing({ ...editing!, username: e.target.value })}
                                    placeholder="Username"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                                    required
                                />
                                <input
                                    value={editing?.password || ''}
                                    onChange={e => setEditing({ ...editing!, password: e.target.value })}
                                    placeholder="Password"
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                                    required
                                />
                                <input
                                    value={editing?.url || ''}
                                    onChange={e => setEditing({ ...editing!, url: e.target.value })}
                                    placeholder="URL"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                                />
                                <div className="flex gap-2">
                                    <input
                                        value={editing?.otpSecret || ''}
                                        onChange={e => setEditing({ ...editing!, otpSecret: e.target.value.replace(/\s/g, '').toUpperCase() })}
                                        placeholder="2FA Secret (optional)"
                                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                                    />
                                    <label className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 cursor-pointer flex items-center justify-center aspect-square" title="Upload QR Code">
                                        <QrCode size={20} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                                    </label>
                                </div>
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => { setShowAdd(false); setEditing(null); }} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl transition-all">Save Entry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
