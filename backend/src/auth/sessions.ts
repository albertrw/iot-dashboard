import crypto from "crypto";
import { db } from "../db";

export type SessionUser = { id: string; email: string };

function sha256Bytes(input: string) {
  return crypto.createHash("sha256").update(input).digest(); // Buffer
}

export function generateSessionToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function ttlDays() {
  const d = Number(process.env.SESSION_TTL_DAYS ?? 7);
  return Number.isFinite(d) && d > 0 ? d : 7;
}

export async function createSession(userId: string) {
  const token = generateSessionToken(32);
  const tokenHash = sha256Bytes(token);
  const days = ttlDays();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.query(
    `
    INSERT INTO auth_sessions (token_hash, user_id, expires_at)
    VALUES ($1, $2, $3)
    `,
    [tokenHash, userId, expiresAt]
  );

  return { token, expires_at: expiresAt.toISOString() };
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const tokenHash = sha256Bytes(token);

  const { rows } = await db.query(
    `
    SELECT u.id, u.email
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
      AND s.expires_at > now()
    LIMIT 1
    `,
    [tokenHash]
  );

  if (rows.length === 0) return null;

  // best-effort touch
  void db.query(`UPDATE auth_sessions SET last_used_at = now() WHERE token_hash = $1`, [tokenHash]).catch(
    () => {}
  );

  return { id: rows[0].id as string, email: rows[0].email as string };
}

export async function deleteSession(token: string) {
  const tokenHash = sha256Bytes(token);
  await db.query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [tokenHash]);
}

export async function deleteUserSessions(userId: string) {
  await db.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
}
