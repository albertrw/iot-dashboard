import { db } from "../db";

const HIDE_AFTER_SEC = Number(process.env.COMPONENT_HIDE_AFTER_SEC ?? 120);
const CHECK_EVERY_MS = Number(process.env.COMPONENT_HIDE_CHECK_MS ?? 15000);

export function startComponentAutoHideMonitor() {
  setInterval(async () => {
    try {
      await db.query(
        `
        UPDATE components
        SET meta = jsonb_set(
          jsonb_set(meta, '{hidden}', to_jsonb(true), true),
          '{hidden_reason}', to_jsonb('stale'::text), true
        )
        WHERE kind = 'sensor'
          AND COALESCE((meta->>'hidden')::boolean, false) = false
          AND (
            (last_seen_at IS NOT NULL AND last_seen_at < now() - ($1 * interval '1 second'))
            OR (last_seen_at IS NULL AND created_at < now() - ($1 * interval '1 second'))
          )
        `,
        [HIDE_AFTER_SEC]
      );
    } catch (err) {
      console.error("Component auto-hide monitor error:", err);
    }
  }, CHECK_EVERY_MS);
}
