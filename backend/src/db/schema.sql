-- Enable crypto helpers (UUID + hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS (minimal for now)
-- =========================
-- You can replace this later with a full auth system.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- DEVICES (microcontrollers)
-- =========================
-- A "device" is the microcontroller/controller unit.
-- Claim flow:
--  - Dashboard creates device -> claim_token shown once
--  - Device calls claim endpoint with token -> device becomes owned (owner_user_id set)
--  - Later: device authenticates with device_secret (rotatable)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- A stable external identifier used in MQTT topics etc.
  -- Could be a printed sticker / firmware id, e.g. "dev_8f3a..."
  device_uid TEXT UNIQUE NOT NULL,

  owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  name TEXT NULL,
  description TEXT NULL,

  status TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'active', 'revoked')),

  -- Store hashes only (never store raw tokens)
  claim_token_hash BYTEA NULL,
  claim_expires_at TIMESTAMPTZ NULL,

  device_secret_hash BYTEA NULL,
  secret_rotated_at TIMESTAMPTZ NULL,

  last_seen_at TIMESTAMPTZ NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_online ON devices(is_online);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_uid TEXT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_owner_time
  ON notifications(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_owner_unread
  ON notifications(owner_user_id, read_at);

-- =========================
-- COMPONENTS (sensors/actuators)
-- =========================
-- One device has many components.
-- key examples: temp1, hum1, motorA, relay2
CREATE TABLE IF NOT EXISTS components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  component_key TEXT NOT NULL, -- unique per device
  kind TEXT NOT NULL CHECK (kind IN ('sensor', 'actuator')),

  name TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Dynamic metadata about pins, units, ranges, etc.
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  last_seen_at TIMESTAMPTZ NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_components_device_key UNIQUE (device_id, component_key)
);

CREATE INDEX IF NOT EXISTS idx_components_device ON components(device_id);
CREATE INDEX IF NOT EXISTS idx_components_kind ON components(kind);
CREATE INDEX IF NOT EXISTS idx_components_online ON components(is_online);
CREATE INDEX IF NOT EXISTS idx_components_last_seen ON components(last_seen_at);

-- =========================
-- LATEST TELEMETRY/STATE (per component)
-- =========================
-- This is what the dashboard shows "right now".
CREATE TABLE IF NOT EXISTS component_latest (
  component_id UUID PRIMARY KEY REFERENCES components(id) ON DELETE CASCADE,

  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_latest_updated ON component_latest(updated_at);

-- =========================
-- OPTIONAL: TELEMETRY HISTORY (for charts later)
-- =========================
-- Keep it optional; enable when you want charts/history.
CREATE TABLE IF NOT EXISTS telemetry_history (
  id BIGSERIAL PRIMARY KEY,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,

  payload JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_history_component_time
  ON telemetry_history(component_id, recorded_at DESC);

-- =========================
-- OPTIONAL: COMMAND LOG (audit/retries later)
-- =========================
CREATE TABLE IF NOT EXISTS command_log (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  component_id UUID NULL REFERENCES components(id) ON DELETE SET NULL,

  command JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'acked', 'failed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_command_log_device_time
  ON command_log(device_id, created_at DESC);
