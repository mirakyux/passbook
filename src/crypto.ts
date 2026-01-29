/**
 * Passbook Crypto Utility
 * Handles Zero-Knowledge encryption/decryption using Web Crypto API.
 */

const ITERATIONS = 100000;
const KEY_LEN = 256;
const ALGO = 'AES-GCM';

async function deriveKey(password: string, salt: string, purpose: 'encryption' | 'auth') {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode(salt + purpose),
            iterations: ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: ALGO, length: KEY_LEN },
        true,
        purpose === 'encryption' ? ['encrypt', 'decrypt'] : []
    );
}

export async function getAuthKey(password: string) {
    // We derive a hash to send to the backend for record lookup/auth
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const authBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: enc.encode('auth-salt-constant'), // In real app, this should be unique per user
            iterations: ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    return Array.from(new Uint8Array(authBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function encrypt(data: any, password: string) {
    const salt = 'encryption-salt-constant';
    const key = await deriveKey(password, salt, 'encryption');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        key,
        enc.encode(JSON.stringify(data))
    );

    const cipherBuffer = new Uint8Array(encrypted);
    // AES-GCM tags are appended to the ciphertext in Web Crypto
    const tag = cipherBuffer.slice(-16);
    const payload = cipherBuffer.slice(0, -16);

    return {
        payload: btoa(String.fromCharCode(...payload)),
        iv: btoa(String.fromCharCode(...iv)),
        tag: btoa(String.fromCharCode(...tag))
    };
}

export async function decrypt(encrypted: { payload: string, iv: string, tag: string }, password: string) {
    const salt = 'encryption-salt-constant';
    const key = await deriveKey(password, salt, 'encryption');

    const iv = new Uint8Array(atob(encrypted.iv).split('').map(c => c.charCodeAt(0)));
    const payload = new Uint8Array(atob(encrypted.payload).split('').map(c => c.charCodeAt(0)));
    const tag = new Uint8Array(atob(encrypted.tag).split('').map(c => c.charCodeAt(0)));

    const combined = new Uint8Array(payload.length + tag.length);
    combined.set(payload);
    combined.set(tag, payload.length);

    const decrypted = await crypto.subtle.decrypt(
        { name: ALGO, iv },
        key,
        combined
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}
