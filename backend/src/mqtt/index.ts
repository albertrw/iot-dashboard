declare global {
  // eslint-disable-next-line no-var
  var __mqttStarted: boolean | undefined;
}

import "dotenv/config";
import mqtt from "mqtt";
import { db } from "../db";
import {
  broadcastComponentLatest,
  broadcastDeviceStatus,
  broadcastComponentStatus,
  broadcastNotification,
} from "../websocket";

const NOTIF_DEDUPE_SEC = Number(process.env.NOTIFICATION_DEDUPE_SEC ?? 60);

function parseJson(buf: Buffer) {
  return JSON.parse(buf.toString("utf8"));
}

async function getDevice(device_uid: string): Promise<{ id: string; owner_user_id: string | null } | null> {
  const devRes = await db.query(
    `select id, owner_user_id from devices where device_uid = $1`,
    [device_uid]
  );
  if (devRes.rowCount === 0) return null;
  return {
    id: devRes.rows[0].id as string,
    owner_user_id: (devRes.rows[0].owner_user_id as string | null) ?? null,
  };
}

/**
 * Manifest is SOURCE OF TRUTH:
 * - upsert kind/capabilities/meta based on manifest
 */
async function upsertFromManifest(device_id: string, comp: any) {
  const component_key = String(comp?.key ?? "");
  if (!component_key) return;

  const kind = comp?.kind === "actuator" ? "actuator" : "sensor";
  const capabilities = comp?.capabilities ?? {};
  const meta = {
    ...(comp?.meta ?? {}),
    name: comp?.name ?? comp?.meta?.name ?? component_key,
  };

  await db.query(
    `
    insert into components (device_id, component_key, kind, capabilities, meta)
    values ($1, $2, $3, $4::jsonb, $5::jsonb)
    on conflict (device_id, component_key)
    do update set
      kind = excluded.kind,
      capabilities = excluded.capabilities,
      meta = excluded.meta
    `,
    [
      device_id,
      component_key,
      kind,
      JSON.stringify(capabilities),
      JSON.stringify(meta),
    ]
  );
}

/**
 * Telemetry can arrive before manifest:
 * - create a stub component if missing
 * - DO NOT overwrite kind/capabilities/meta if it already exists
 */
async function ensureComponentStub(
  device_id: string,
  component_key: string
): Promise<string> {
  const ins = await db.query(
    `
    insert into components (device_id, component_key, kind, capabilities, meta)
    values ($1, $2, 'sensor', '{}'::jsonb, '{}'::jsonb)
    on conflict (device_id, component_key)
    do nothing
    returning id
    `,
    [device_id, component_key]
  );

  if (ins.rowCount > 0) return ins.rows[0].id as string;

  const existing = await db.query(
    `select id from components where device_id = $1 and component_key = $2 limit 1`,
    [device_id, component_key]
  );
  return existing.rows[0].id as string;
}

if (!global.__mqttStarted) {
  global.__mqttStarted = true;

  const MQTT_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
  const client = mqtt.connect(MQTT_URL);

  client.on("connect", () => {
    console.log("MQTT connected");
    client.subscribe("devices/+/telemetry/+");
    client.subscribe("devices/+/meta/components"); // ✅ subscribe manifest
    client.subscribe("devices/+/status");
  });

  client.on("message", async (topic, payloadBuf) => {
    try {
      const parts = topic.toString().split("/");
      // devices/{device_uid}/{section}/...
      if (parts.length < 3 || parts[0] !== "devices") return;

      const device_uid = parts[1];
      const section = parts[2];

      const device = await getDevice(device_uid);
      if (!device) {
        console.log("Unknown device_uid:", device_uid);
        return;
      }
      const device_id = device.id;
      const owner_user_id = device.owner_user_id;

      // ✅ Manifest handler: devices/{uid}/meta/components
      if (section === "meta" && parts[3] === "components") {
        const payload = parseJson(payloadBuf);
        const comps = payload?.components;
        if (!Array.isArray(comps)) return;

        const manifestKeys: string[] = [];
        for (const comp of comps) {
          const key = String(comp?.key ?? "");
          if (!key) continue;
          manifestKeys.push(key);
          await upsertFromManifest(device_id, comp);
        }

        if (manifestKeys.length > 0) {
          await db.query(
            `
            UPDATE components
            SET meta = jsonb_set(
              jsonb_set(meta, '{hidden}', to_jsonb(true), true),
              '{hidden_reason}', to_jsonb('manifest'), true
            )
            WHERE device_id = $1
              AND component_key <> ALL($2::text[])
            `,
            [device_id, manifestKeys]
          );

          await db.query(
            `
            UPDATE components
            SET meta = jsonb_strip_nulls(
              jsonb_set(
                jsonb_set(meta, '{hidden}', to_jsonb(false), true),
                '{hidden_reason}', 'null'::jsonb, true
              )
            )
            WHERE device_id = $1
              AND component_key = ANY($2::text[])
              AND (meta->>'hidden_reason') = 'manifest'
            `,
            [device_id, manifestKeys]
          );
        }

        return;
      }

      // ✅ Telemetry handler: devices/{uid}/telemetry/{component_key}
      if (section === "telemetry") {
        const payload = parseJson(payloadBuf);
        const component_key = parts[3];
        if (!component_key) return;

        const component_id = await ensureComponentStub(device_id, component_key);

        await db.query(
          `
          insert into component_latest (component_id, payload)
          values ($1, $2::jsonb)
          on conflict (component_id)
          do update set payload = excluded.payload,
                        updated_at = now()
          `,
          [component_id, JSON.stringify(payload)]
        );

        const compStatusRes = await db.query(
          `
          UPDATE components
          SET last_seen_at = now(), is_online = true
          WHERE id = $1 AND (is_online = false OR is_online IS NULL)
          RETURNING last_seen_at
          `,
          [component_id]
        );

        if (compStatusRes.rowCount > 0 && owner_user_id) {
          broadcastComponentStatus({
            owner_user_id,
            device_uid,
            component_key,
            is_online: true,
            last_seen_at: compStatusRes.rows[0].last_seen_at,
          });
        } else {
          await db.query(`update components set last_seen_at = now(), is_online = true where id = $1`, [
            component_id,
          ]);
        }

        await db.query(
          `
          UPDATE components
          SET meta = jsonb_strip_nulls(
            jsonb_set(
              jsonb_set(meta, '{hidden}', to_jsonb(false), true),
              '{hidden_reason}', 'null'::jsonb, true
            )
          )
          WHERE id = $1 AND (meta->>'hidden_reason') = 'stale'
          `,
          [component_id]
        );

        // update last seen + online status
        const statusRes = await db.query(
          `
          UPDATE devices
          SET last_seen_at = now(), is_online = true
          WHERE id = $1 AND (is_online = false OR is_online IS NULL)
          RETURNING device_uid, last_seen_at
          `,
          [device_id]
        );

        if (statusRes.rowCount > 0) {
          const row = statusRes.rows[0];
          if (owner_user_id) {
            broadcastDeviceStatus({
              owner_user_id,
              device_uid: row.device_uid,
              is_online: true,
              last_seen_at: row.last_seen_at,
            });
          }
        } else {
          await db.query(`update devices set last_seen_at = now(), is_online = true where id = $1`, [
            device_id,
          ]);
        }

        // 🔥 push live update to WebSocket clients
        if (owner_user_id) {
          broadcastComponentLatest({
            owner_user_id,
            device_uid,
            component_key,
            payload,
            updated_at: new Date().toISOString(),
          });
        }

        return;
      }

      // ✅ Status handler: devices/{uid}/status
      if (section === "status") {
        const raw = payloadBuf.toString("utf8").trim();
        let nextOnline: boolean | null = null;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.online === "boolean") nextOnline = parsed.online;
          if (typeof parsed?.is_online === "boolean") nextOnline = parsed.is_online;
          if (typeof parsed?.state === "string") {
            if (parsed.state === "online") nextOnline = true;
            if (parsed.state === "offline") nextOnline = false;
          }
        } catch {
          if (raw === "online") nextOnline = true;
          if (raw === "offline") nextOnline = false;
        }

        if (nextOnline == null) return;

        if (nextOnline) {
          const becameOnline = await db.query(
            `
            UPDATE devices
            SET is_online = true, last_seen_at = now()
            WHERE id = $1 AND is_online IS DISTINCT FROM true
            RETURNING device_uid, name, owner_user_id, last_seen_at
            `,
            [device_id]
          );

          if (becameOnline.rowCount > 0) {
            const row = becameOnline.rows[0];
            if (row.owner_user_id) {
              broadcastDeviceStatus({
                owner_user_id: row.owner_user_id,
                device_uid: row.device_uid,
                is_online: true,
                last_seen_at: row.last_seen_at,
              });
            }
          } else {
            await db.query(`UPDATE devices SET last_seen_at = now() WHERE id = $1`, [device_id]);
          }
        } else {
          const wentOffline = await db.query(
            `
            UPDATE devices
            SET is_online = false
            WHERE id = $1 AND is_online IS DISTINCT FROM false
            RETURNING device_uid, name, owner_user_id, last_seen_at
            `,
            [device_id]
          );

          if (wentOffline.rowCount === 0) return;

          const row = wentOffline.rows[0];
          if (row.owner_user_id) {
            broadcastDeviceStatus({
              owner_user_id: row.owner_user_id,
              device_uid: row.device_uid,
              is_online: false,
              last_seen_at: row.last_seen_at,
            });
          }

          if (row.owner_user_id) {
            const label = row.name?.trim() ? row.name.trim() : row.device_uid;
            const title = "Device offline";
            const body = `Device ${label} (${row.device_uid}) is offline.`;

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
        }

        return;
      }

      // ignore other topics
    } catch (err) {
      console.error("MQTT ingest error:", err);
    }
  });
} else {
  console.log("MQTT already started, skipping");
}

export {};
