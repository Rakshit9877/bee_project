const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const databasePath = path.resolve(process.env.DATABASE_PATH || './data/medqueue.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'staff')),
    access_code_hash TEXT,
    created_at TEXT NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_served INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS queue_entries (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symptoms TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
    duration TEXT NOT NULL,
    additional_info TEXT NOT NULL DEFAULT '',
    vital_flags TEXT NOT NULL DEFAULT '[]',
    triage_score REAL NOT NULL,
    ticket TEXT NOT NULL UNIQUE,
    registered_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'served')),
    served_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_queue_waiting
    ON queue_entries(status, triage_score DESC, registered_at ASC);
  CREATE INDEX IF NOT EXISTS idx_queue_patient
    ON queue_entries(patient_id, registered_at DESC);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_entry_per_patient
    ON queue_entries(patient_id) WHERE status = 'waiting';
`);

module.exports = db;
