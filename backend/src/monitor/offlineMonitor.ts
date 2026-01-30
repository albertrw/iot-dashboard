import { db } from "../db";
import { broadcastDeviceStatus, broadcastNotification } from "../websocket";

const OFFLINE_AFTER_SEC = Number(process.env.DEVICE_OFFLINE_AFTER_SEC ?? 20);
const CHECK_EVERY_MS = Number(process.env.DEVICE_OFFLINE_CHECK_MS ?? 5000);
const NOTIF_DEDUPE_SEC = Number(process.env.NOTIFICATION_DEDUPE_SEC ?? 60);

type OfflineRow = {
  device_uid: string;
  name: string | null;
  owner_user_id: string | null;
  last_seen_at: string | null;
};

export function startOfflineMonitor() {
  setInterval(async () => {
    try {
      const { rows } = await db.query<OfflineRow>(
        `
        UPDATE devices
        SET is_online = false
        WHERE is_online = true
          AND last_seen_at < now() - ($1 * interval '1 second')
        RETURNING device_uid, name, owner_user_id, last_seen_at
        `,
        [OFFLINE_AFTER_SEC]
      );

      for (const row of rows) {
        if (!row.owner_user_id) continue;

        const label = row.name?.trim() ? row.name.trim() : row.device_uid;
        const title = "Device offline";
        const body = `Device ${label} (${row.device_uid}) is offline.`;

        broadcastDeviceStatus({
          device_uid: row.device_uid,
          is_online: false,
          last_seen_at: row.last_seen_at ?? null,
        });

        const inserted = await db.query(
          `
          INSERT INTO notifications (owner_user_id, device_uid, title, body, type)
          SELECT $1, $2, $3, $4, 'system'
          WHERE NOT EXISTS (
            SELECT 1
            FROM notifications
            WHERE owner_user_id = $1
              AND device_uid = $2
              AND title = $3
              AND type = 'system'
              AND created_at > now() - ($5 * interval '1 second')
          )
          RETURNING id, owner_user_id, device_uid, title, body, type, read_at, created_at
          `,
          [row.owner_user_id, row.device_uid, title, body, NOTIF_DEDUPE_SEC]
        );

        if (inserted.rowCount > 0) {
          broadcastNotification(inserted.rows[0]);
        }
      }
    } catch (err) {
      console.error("Offline monitor error:", err);
    }
  }, CHECK_EVERY_MS);
}
