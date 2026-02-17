# IoT Dashboard

Monorepo:
- `backend/`: Express + PostgreSQL + MQTT + WebSocket
- `dashboard/`: React (Vite)

## Auth (multi-user)

The backend uses **token sessions stored in PostgreSQL** (table `auth_sessions`). The dashboard stores the token in `localStorage` under `auth_token` and sends it as `Authorization: Bearer <token>` for API + WebSocket.
WebSocket auth is sent via `Sec-WebSocket-Protocol` (so the token is not placed in the URL).

### Required DB schema

Run (or re-run) the schema to create missing tables (safe to run multiple times):

```bash
psql -d iot_dashboard -f backend/src/db/schema.sql
```

### Backend env

Copy `backend/.env.example` to `backend/.env` and fill values.

### Dashboard env

Copy `dashboard/.env.example` to `dashboard/.env` (optional).
