CREATE TABLE users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    tesla_account_id  TEXT NOT NULL UNIQUE,   -- vault_uuid from /api/1/users/me
    email             TEXT,
    created_at        INTEGER NOT NULL
);

CREATE TABLE oauth_tokens (
    user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    access_token   TEXT NOT NULL,
    refresh_token  TEXT NOT NULL,
    expires_at     INTEGER NOT NULL           -- unix seconds
);

CREATE TABLE vehicles (
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vin               TEXT NOT NULL,
    display_name      TEXT,
    paired            INTEGER NOT NULL DEFAULT 0,
    paired_at         INTEGER,
    last_verified_at  INTEGER,                       -- when fleet_status last checked
    PRIMARY KEY (user_id, vin)
);

CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL
);

CREATE TABLE pending_oauth (
    state          TEXT PRIMARY KEY,
    code_verifier  TEXT NOT NULL,
    created_at     INTEGER NOT NULL
);
