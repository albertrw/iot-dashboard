import { db } from "../db";
import { broadcastComponentStatus, broadcastNotification } from "../websocket";

const OFFLINE_AFTER_SEC = Number(process.env.COMPONENT_OFFLINE_AFTER_SEC ?? 20);
const CHECK_EVERY_MS = Number(process.env.COMPONENT_OFFLINE_CHECK_MS ?? 5000);

type OfflineRow = {
  component_key: string;
  device_uid: string;
  owner_user_id: string | null;
  last_seen_at: string | null;
  meta: any;
};

function componentLabel(row: OfflineRow) {
  const metaName = row.meta?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  return row.component_key;
}

export function startComponentOfflineMonitor() {
  setInterval(async () => {
    try {
      const { rows } = await db.query<OfflineRow>(
        `
        UPDATE components c
        SET is_online = false
        FROM devices d
        WHERE c.device_id = d.id
          AND c.is_online = true
          AND c.kind = 'sensor'
          AND c.last_seen_at < now() - ($1 * interval '1 second')
        RETURNING c.component_key, c.last_seen_at, c.meta, d.device_uid, d.owner_user_id
        `,
        [OFFLINE_AFTER_SEC]
      );

      for (const row of rows) {
        if (!row.owner_user_id) continue;

        const label = componentLabel(row);
        const title = "Component offline";
        const body = `Component ${label} (${row.component_key}) on device ${row.device_uid} is offline.`;

        const inserted = await db.query(
          `
          INSERT INTO notifications (owner_user_id, device_uid, title, body, type)
          VALUES ($1, $2, $3, $4, 'system')
          RETURNING id, owner_user_id, device_uid, title, body, type, read_at, created_at
          `,
          [row.owner_user_id, row.device_uid, title, body]
        );

        broadcastComponentStatus({
          device_uid: row.device_uid,
          component_key: row.component_key,
          is_online: false,
          last_seen_at: row.last_seen_at,
        });

        broadcastNotification(inserted.rows[0]);
      }
    } catch (err) {
      console.error("Component offline monitor error:", err);
    }
  }, CHECK_EVERY_MS);
}
