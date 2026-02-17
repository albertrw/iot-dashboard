import { Router } from "express";
import { db } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, deleteSession, deleteUserSessions } from "../auth/sessions";

export const authRouter = Router();

const AVATAR_KEYS = [
  "avatar-cat",
  "avatar-dog",
  "avatar-fox",
  "avatar-panda",
  "avatar-robot",
] as const;

function sanitizeAvatarKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return (AVATAR_KEYS as readonly string[]).includes(v) ? v : null;
}

function parseAvatarKey(v: unknown): { ok: true; key: string | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, key: null };
  if (typeof v !== "string") return { ok: false };
  const trimmed = v.trim();
  if (!trimmed || trimmed === "default") return { ok: true, key: null };
  if (!(AVATAR_KEYS as readonly string[]).includes(trimmed)) return { ok: false };
  return { ok: true, key: trimmed };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function pickUserRow(row: any) {
  return {
    id: row.id as string,
    email: row.email as string,
    avatar_key: sanitizeAvatarKey(row.avatar_key),
  };
}

authRouter.post("/register", async (req, res) => {
  try {
    const emailRaw = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const email = normalizeEmail(emailRaw);
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const passwordHash = await hashPassword(password);

    const { rows } = await db.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, avatar_key, created_at
      `,
      [email, passwordHash]
    );

    const user = pickUserRow(rows[0]);
    const session = await createSession(user.id);

    return res.status(201).json({ token: session.token, user, expires_at: session.expires_at });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (msg.includes("duplicate key") || msg.includes("users_email_key")) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error("POST /api/auth/register failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const emailRaw = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const email = normalizeEmail(emailRaw);
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const { rows } = await db.query(
      `SELECT id, email, avatar_key, password_hash FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const row = rows[0] as { id: string; email: string; avatar_key: string | null; password_hash: string };
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const user = pickUserRow(row);
    const session = await createSession(user.id);
    return res.json({ token: session.token, user, expires_at: session.expires_at });
  } catch (err: any) {
    console.error("POST /api/auth/login failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { rows } = await db.query(`SELECT id, email, avatar_key FROM users WHERE id = $1 LIMIT 1`, [
    r.user.id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: "User not found" });
  return res.json({ user: pickUserRow(rows[0]) });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const token = (req.header("authorization") ?? req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token) {
    await deleteSession(token);
  }
  return res.json({ ok: true });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const userId = r.user.id;

  const currentPassword =
    typeof req.body?.current_password === "string" ? req.body.current_password : "";
  const newPassword =
    typeof req.body?.new_password === "string" ? req.body.new_password : "";

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "current_password and new_password are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "New password must be different" });
  }

  try {
    const { rows } = await db.query(
      `SELECT id, email, avatar_key, password_hash FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = rows[0] as { id: string; email: string; avatar_key: string | null; password_hash: string };
    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    const nextHash = await hashPassword(newPassword);
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [nextHash, userId]);

    // Revoke all sessions, then issue a new one.
    await deleteUserSessions(userId);
    const session = await createSession(userId);

    return res.json({
      token: session.token,
      expires_at: session.expires_at,
      user: pickUserRow(row),
    });
  } catch (err: any) {
    console.error("POST /api/auth/change-password failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  try {
    const r = req as unknown as AuthedRequest;
    const userId = r.user.id;

    const parsed = parseAvatarKey(req.body?.avatar_key);
    if (!parsed.ok) {
      return res.status(400).json({ error: "Invalid avatar_key" });
    }
    const avatarKey = parsed.key;

    const { rows } = await db.query(
      `
      UPDATE users
      SET avatar_key = $2
      WHERE id = $1
      RETURNING id, email, avatar_key
      `,
      [userId, avatarKey]
    );

    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json({ user: pickUserRow(rows[0]) });
  } catch (err: any) {
    console.error("PATCH /api/auth/profile failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
