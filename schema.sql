CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL, -- Encrypted JSON
    iv TEXT NOT NULL,      -- Metadata for decryption
    tag TEXT NOT NULL,     -- Metadata for decryption
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
