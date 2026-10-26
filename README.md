# MedQueue

MedQueue is an educational full-stack triage queue application built with vanilla HTML/CSS/JavaScript, Node.js, Express, and SQLite.

> **Educational disclaimer:** This project is non-diagnostic and does not provide medical advice, diagnosis, or treatment. Do not use it to make real clinical decisions.

## Requirements

- Node.js 22.13 or newer
- npm

## Run locally

1. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`; macOS/Linux: `cp .env.example .env`).
2. Set `JWT_SECRET` to a random secret of at least 32 characters. Set a private `STAFF_INVITE_CODE`; it is required when creating a staff account.
3. Install dependencies and start the app:

   ```sh
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

SQLite data is stored in `data/medqueue.sqlite` by default. Set `DATABASE_PATH` to change its location. The database and environment file are excluded from Git.

For development with automatic server restarts, use `npm run dev`.

## CRUD API

All API responses use JSON. Authenticated routes require `Authorization: Bearer <token>`; login returns a 12-hour token. Patient accounts can only access their own queue entries. Staff-only operations are protected by role checks.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Create patient account; staff signup also requires `staffInviteCode` |
| `POST` | `/api/auth/login` | Public | Authenticate and receive a token |
| `GET` | `/api/auth/me` | Signed in | Read current account |
| `GET`, `PATCH` | `/api/users/me` | Signed in | Read or update own profile name |
| `POST` | `/api/users/me/access-code` | Staff | Rotate staff access code |
| `GET` | `/api/queue` | Signed in | List queue (staff) or own history (patient) |
| `GET` | `/api/queue/:id` | Signed in | Read one authorized queue entry |
| `POST` | `/api/queue` | Patient | Create check-in |
| `PUT` | `/api/queue/:id` | Owning patient | Update a waiting check-in |
| `DELETE` | `/api/queue/:id` | Owner or staff | Cancel/delete a queue entry |
| `PATCH` | `/api/queue/:id/priority` | Staff | Apply emergency priority override |
| `POST` | `/api/queue/call-next` | Staff | Mark the highest-priority waiting entry served |
| `GET` | `/api/queue/ticket/:ticket` | Public | Look up a ticket without exposing symptom details |
| `GET` | `/api/health` | Public | Health check |

The server validates check-in data and calculates the triage score itself; it does not trust a score supplied by the browser. Passwords and staff access codes are hashed. The staff invitation code is an administrative enrollment gate, not a substitute for real-world identity verification.

## Screenshots

See `screenshots/` for existing project UI examples.
