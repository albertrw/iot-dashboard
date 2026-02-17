import { Router } from "express";
import { db } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const beforeId = Number(req.query.before_id ?? 0);
    const filter = req.query.filter === "unread" ? "unread" : "all";

    const params: any[] = [ownerUserId];
    let where = "WHERE owner_user_id = $1";
    if (filter === "unread") {
      where += " AND read_at IS NULL";
    }
    if (Number.isFinite(beforeId) && beforeId > 0) {
      params.push(beforeId);
      where += ` AND id < $${params.length}`;
    }
    params.push(limit);

    const { rows } = await db.query(
      `
      SELECT id, owner_user_id, device_uid, title, body, type, read_at, created_at
      FROM notifications
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length}
      `,
      params
    );

    return res.json(rows);
  } catch (err: any) {
    console.error("GET /api/notifications failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

notificationsRouter.post("/", async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    const device_uid = typeof req.body?.device_uid === "string" ? req.body.device_uid : null;
    const type = typeof req.body?.type === "string" ? req.body.type : "system";

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const { rows } = await db.query(
      `
      INSERT INTO notifications (owner_user_id, device_uid, title, body, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, owner_user_id, device_uid, title, body, type, read_at, created_at
      `,
      [ownerUserId, device_uid, title, body, type]
    );

    return res.json(rows[0]);
  } catch (err: any) {
    console.error("POST /api/notifications failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

notificationsRouter.post("/read-all", async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;

    await db.query(
      `
      UPDATE notifications
      SET read_at = now()
      WHERE owner_user_id = $1 AND read_at IS NULL
      `,
      [ownerUserId]
    );

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/notifications/read-all failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

notificationsRouter.post("/:id/read", async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid notification id" });
    }

    const { rows } = await db.query(
      `
      UPDATE notifications
      SET read_at = now()
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id, owner_user_id, device_uid, title, body, type, read_at, created_at
      `,
      [id, ownerUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json(rows[0]);
  } catch (err: any) {
    console.error("POST /api/notifications/:id/read failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});
