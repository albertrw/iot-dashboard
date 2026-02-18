import { Router } from "express";
import crypto from "crypto";
import { db } from "../db";
import { mqttClient } from "../mqtt/client";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { provisionMqttUser } from "../mqtt/provision";



export const devicesRouter = Router();

/**
 * Helper: generate a friendly device UID (printed/sticker/firmware id)
 * Example: dev_a1b2c3d4e5f6a7b8
 */
function generateDeviceUid() {
  return "dev_" + crypto.randomBytes(8).toString("hex");
}

/** Claim token + device secret are high-entropy random strings */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex"); // 64 chars when bytes=32
}

/** Store only SHA-256 hash (BYTEA) in DB */
function sha256Bytes(input: string) {
  return crypto.createHash("sha256").update(input).digest(); // Buffer
}

devicesRouter.get("/:deviceUid", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;

    // 1) device (must belong to user)
    const devRes = await db.query(
      `
      SELECT id, device_uid, name, description, status, last_seen_at, is_online
      FROM devices
      WHERE device_uid = $1 AND owner_user_id = $2
      LIMIT 1
      `,
      [deviceUid, ownerUserId]
    );

    if (devRes.rows.length === 0) {
      return res.status(404).json({ error: "Device not found (or not yours)" });
    }

    const device = devRes.rows[0];

    // 2) components
    const compRes = await db.query(
      `
      SELECT id, device_id, component_key, kind, capabilities, meta, is_online, last_seen_at
      FROM components
      WHERE device_id = $1
      ORDER BY component_key ASC
      `,
      [device.id]
    );

    const components = compRes.rows;

    // 3) latest (this is basically your verified query, but without device_uid filter)
    const latestRes = await db.query(
      `
      SELECT c.component_key, cl.payload, cl.updated_at
      FROM component_latest cl
      JOIN components c ON c.id = cl.component_id
      WHERE c.device_id = $1
      `,
      [device.id]
    );

    const latest: Record<string, { payload: any; updated_at: string }> = {};
    for (const row of latestRes.rows) {
      latest[row.component_key] = {
        payload: row.payload,
        updated_at: row.updated_at,
      };
    }

    return res.json({ device, components, latest });
  } catch (err: any) {
    console.error("GET /api/devices/:deviceUid failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

devicesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;

    const { rows } = await db.query(
      `
      SELECT id, device_uid, name, description, status, last_seen_at, is_online
      FROM devices
      WHERE owner_user_id = $1
      ORDER BY last_seen_at DESC NULLS LAST, device_uid ASC
      `,
      [ownerUserId]
    );

    return res.json(rows);
  } catch (err: any) {
    console.error("GET /api/devices failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});


/**
 * POST /api/devices
 * Dashboard creates an unclaimed device and receives claim_token ONCE.
 *
 * Headers:
 *  - x-user-id: <uuid>   (temporary until real auth)
 *
 * Body (optional):
 *  - name?: string
 *  - description?: string
 *
 * Response:
 *  - device_uid
 *  - claim_token  (show once, store safely)
 *  - claim_expires_at
 */
devicesRouter.post("/", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;

    const name = typeof req.body?.name === "string" ? req.body.name : null;
    const description =
      typeof req.body?.description === "string" ? req.body.description : null;

    const deviceUid = generateDeviceUid();
    const claimToken = generateToken(32);
    const claimHash = sha256Bytes(claimToken);

    const ttlMin = Number(process.env.CLAIM_TOKEN_TTL_MIN ?? 10);
    const claimExpiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await db.query(
      `
      INSERT INTO devices (device_uid, owner_user_id, name, description, status, claim_token_hash, claim_expires_at)
      VALUES ($1, $2, $3, $4, 'unclaimed', $5, $6)
      `,
      [deviceUid, ownerUserId, name, description, claimHash, claimExpiresAt]
    );

    res.status(201).json({
      device_uid: deviceUid,
      claim_token: claimToken, // IMPORTANT: show once
      claim_expires_at: claimExpiresAt.toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Bad Request" });
  }
});

/**
 * POST /api/devices/claim
 * Device claims itself using device_uid + claim_token
 *
 * Body:
 *  - device_uid: string
 *  - claim_token: string
 *
 * Response:
 *  - device_secret (long-lived secret shown once)
 */
devicesRouter.post("/claim", async (req, res) => {
  try {
    const deviceUid = req.body?.device_uid;
    const claimToken = req.body?.claim_token;

    if (typeof deviceUid !== "string" || deviceUid.length < 5) {
      return res.status(400).json({ error: "device_uid is required" });
    }
    if (typeof claimToken !== "string" || claimToken.length < 20) {
      return res.status(400).json({ error: "claim_token is required" });
    }

    // Fetch device
    const { rows } = await db.query(
      `
      SELECT id, status, claim_token_hash, claim_expires_at
      FROM devices
      WHERE device_uid = $1
      `,
      [deviceUid]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Device not found" });

    const device = rows[0];

    if (device.status !== "unclaimed") {
      return res.status(400).json({ error: "Device is not claimable" });
    }
    if (!device.claim_token_hash || !device.claim_expires_at) {
      return res.status(400).json({ error: "Device has no active claim token" });
    }
    if (new Date(device.claim_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Claim token expired" });
    }

    const presentedHash = sha256Bytes(claimToken);

    // Constant-time compare to reduce timing attacks
    const storedHash: Buffer = device.claim_token_hash;
    if (
      storedHash.length !== presentedHash.length ||
      !crypto.timingSafeEqual(storedHash, presentedHash)
    ) {
      return res.status(401).json({ error: "Invalid claim token" });
    }

    // Issue long-lived device secret
    const deviceSecret = generateToken(32);
    const secretHash = sha256Bytes(deviceSecret);

    await db.query(
      `
      UPDATE devices
      SET
        status = 'active',
        claimed_at = now(),
        last_seen_at = now(),
        device_secret_hash = $2,
        secret_rotated_at = now(),
        claim_token_hash = NULL,
        claim_expires_at = NULL
      WHERE id = $1
      `,
      [device.id, secretHash]
    );

    const provision = await provisionMqttUser({
      device_uid: deviceUid,
      device_secret: deviceSecret,
    });
    if (!provision.ok) {
      console.error("MQTT provisioning failed for", deviceUid, ":", provision.error);
    }

    res.json({
      device_uid: deviceUid,
      device_secret: deviceSecret, // IMPORTANT: show once
      mqtt_provisioned: provision.ok,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Server error" });
  }
});

/**
 * POST /api/devices/provision-mqtt
 * Bootstrap helper for existing devices:
 * - device proves it knows its device_secret
 * - backend provisions/updates the Mosquitto user password (username=device_uid)
 *
 * Body:
 *  - device_uid: string
 *  - device_secret: string
 */
devicesRouter.post("/provision-mqtt", async (req, res) => {
  try {
    const deviceUid = req.body?.device_uid;
    const deviceSecret = req.body?.device_secret;

    if (typeof deviceUid !== "string" || deviceUid.length < 5) {
      return res.status(400).json({ error: "device_uid is required" });
    }
    if (typeof deviceSecret !== "string" || deviceSecret.length < 40) {
      return res.status(400).json({ error: "device_secret is required" });
    }

    const { rows } = await db.query(
      `
      SELECT id, status, device_secret_hash
      FROM devices
      WHERE device_uid = $1
      LIMIT 1
      `,
      [deviceUid]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Device not found" });

    const device = rows[0] as { id: string; status: string; device_secret_hash: Buffer | null };
    if (device.status !== "active") {
      return res.status(400).json({ error: "Device is not active" });
    }
    if (!device.device_secret_hash) {
      return res.status(400).json({ error: "Device has no secret" });
    }

    const presentedHash = sha256Bytes(deviceSecret);
    const storedHash = device.device_secret_hash;
    if (
      storedHash.length !== presentedHash.length ||
      !crypto.timingSafeEqual(storedHash, presentedHash)
    ) {
      return res.status(401).json({ error: "Invalid device_secret" });
    }

    const provision = await provisionMqttUser({
      device_uid: deviceUid,
      device_secret: deviceSecret,
    });
    if (!provision.ok) {
      console.error("MQTT provisioning failed for", deviceUid, ":", provision.error);
      return res.status(500).json({ error: "MQTT provisioning failed" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/devices/provision-mqtt failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

/**
 * POST /api/devices/:deviceUid/claim-token
 * Regenerate claim token for unclaimed devices.
 *
 * Headers:
 *  - x-user-id: <uuid>
 *
 * Response:
 *  - device_uid
 *  - claim_token (show once)
 *  - claim_expires_at
 */
devicesRouter.post("/:deviceUid/claim-token", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;

    const { rows } = await db.query(
      `
      SELECT id, status
      FROM devices
      WHERE device_uid = $1 AND owner_user_id = $2
      LIMIT 1
      `,
      [deviceUid, ownerUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Device not found (or not yours)" });
    }

    const device = rows[0];
    if (device.status !== "unclaimed") {
      return res.status(400).json({ error: "Device is already claimed" });
    }

    const claimToken = generateToken(32);
    const claimHash = sha256Bytes(claimToken);
    const ttlMin = Number(process.env.CLAIM_TOKEN_TTL_MIN ?? 10);
    const claimExpiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await db.query(
      `
      UPDATE devices
      SET claim_token_hash = $1, claim_expires_at = $2
      WHERE id = $3
      `,
      [claimHash, claimExpiresAt, device.id]
    );

    return res.json({
      device_uid: deviceUid,
      claim_token: claimToken,
      claim_expires_at: claimExpiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error("POST /api/devices/:deviceUid/claim-token failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});


/**
 * POST /api/devices/:deviceUid/commands
 * Dashboard sends a command to a component (actuator)
 *
 * Body:
 *  - component_key: string
 *  - command: any JSON
 *
 * Example:
 *  { "component_key": "led1", "command": { "state": "on" } }
 */
devicesRouter.post("/:deviceUid/commands", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;

    const componentKey = req.body?.component_key;
    const command = req.body?.command;

    if (typeof componentKey !== "string" || componentKey.length < 1) {
      return res.status(400).json({ error: "component_key is required" });
    }
    if (command === undefined) {
      return res.status(400).json({ error: "command is required" });
    }

    // Ensure device exists and belongs to user
    const devRes = await db.query(
      `SELECT id FROM devices WHERE device_uid = $1 AND owner_user_id = $2`,
      [deviceUid, ownerUserId]
    );

    if (devRes.rows.length === 0) {
      return res.status(404).json({ error: "Device not found (or not yours)" });
    }

    const deviceId = devRes.rows[0].id;

    await db.query(
      `
      INSERT INTO components (device_id, component_key, kind, capabilities, meta)
      VALUES ($1, $2, 'actuator', '{}'::jsonb, '{}'::jsonb)
      ON CONFLICT (device_id, component_key)
      DO UPDATE SET kind = 'actuator'
      `,
      [deviceId, componentKey]
    );

    const topic = `devices/${deviceUid}/command/${componentKey}`;
    const payload = JSON.stringify(command);

    mqttClient.publish(topic, payload, { qos: 0, retain: false }, (err) => {
      if (err) return res.status(500).json({ error: "MQTT publish failed" });
      return res.json({ ok: true, topic, payload });
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

/**
 * PATCH /api/devices/:deviceUid
 * Update device label fields (name/description)
 * Body: { name?: string, description?: string }
 */
devicesRouter.patch("/:deviceUid", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;

    const name = typeof req.body?.name === "string" ? req.body.name : null;
    const description =
      typeof req.body?.description === "string" ? req.body.description : null;

    const upRes = await db.query(
      `
      UPDATE devices
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description)
      WHERE device_uid = $1 AND owner_user_id = $2
      RETURNING id, device_uid, name, description, status, last_seen_at, is_online
      `,
      [deviceUid, ownerUserId, name, description]
    );

    if (upRes.rowCount === 0) {
      return res.status(404).json({ error: "Device not found (or not yours)" });
    }

    return res.json(upRes.rows[0]);
  } catch (err: any) {
    console.error("PATCH /api/devices/:deviceUid failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});


/**
 * DELETE /api/devices/:deviceUid
 * Deletes a device (and related components/latest if FK cascade is set)
 */
devicesRouter.delete("/:deviceUid", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;

    const delRes = await db.query(
      `
      DELETE FROM devices
      WHERE device_uid = $1 AND owner_user_id = $2
      RETURNING device_uid
      `,
      [deviceUid, ownerUserId]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: "Device not found (or not yours)" });
    }

    return res.json({ ok: true, device_uid: delRes.rows[0].device_uid });
  } catch (err: any) {
    console.error("DELETE /api/devices/:deviceUid failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});


/**
 * PATCH /api/devices/:deviceUid/components/:componentKey
 * Body: { name?: string, hidden?: boolean, visual?: string }
 * Stored in components.meta JSONB
 */
devicesRouter.patch("/:deviceUid/components/:componentKey", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;
    const componentKey = req.params.componentKey;

    const name = typeof req.body?.name === "string" ? req.body.name : undefined;
    const hidden =
      typeof req.body?.hidden === "boolean" ? req.body.hidden : undefined;
    const visual =
      typeof req.body?.visual === "string" ? req.body.visual : undefined;

    // Update meta JSONB safely. Only touch keys provided.
    // We'll build new meta = meta || {name,hidden} when present.
    const updates: any[] = [];
    const params: any[] = [deviceUid, ownerUserId, componentKey];
    let idx = 4;

    let metaExpr = "c.meta";

    if (name !== undefined) {
      params.push(name);
      metaExpr = `jsonb_set(${metaExpr}, '{name}', to_jsonb($${idx}::text), true)`;
      idx++;
    }
    if (hidden !== undefined) {
      params.push(hidden);
      metaExpr = `jsonb_set(${metaExpr}, '{hidden}', to_jsonb($${idx}::boolean), true)`;
      idx++;
    }
    if (visual !== undefined) {
      params.push(visual);
      metaExpr = `jsonb_set(${metaExpr}, '{visual}', to_jsonb($${idx}::text), true)`;
      idx++;
    }

    const q = `
      UPDATE components c
      SET meta = ${metaExpr}
      FROM devices d
      WHERE d.id = c.device_id
        AND d.device_uid = $1
        AND d.owner_user_id = $2
        AND c.component_key = $3
      RETURNING c.id, c.component_key, c.kind, c.capabilities, c.meta
    `;

    const upRes = await db.query(q, params);

    if (upRes.rowCount === 0) {
      return res.status(404).json({ error: "Component not found (or not yours)" });
    }

    return res.json(upRes.rows[0]);
  } catch (err: any) {
    console.error("PATCH /api/devices/:deviceUid/components/:componentKey failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});

/**
 * DELETE /api/devices/:deviceUid/components/:componentKey
 * Removes a component record (and latest telemetry via FK cascade).
 */
devicesRouter.delete("/:deviceUid/components/:componentKey", requireAuth, async (req, res) => {
  try {
    const ownerUserId = (req as unknown as AuthedRequest).user.id;
    const deviceUid = req.params.deviceUid;
    const componentKey = req.params.componentKey;

    const delRes = await db.query(
      `
      DELETE FROM components c
      USING devices d
      WHERE d.id = c.device_id
        AND d.device_uid = $1
        AND d.owner_user_id = $2
        AND c.component_key = $3
      RETURNING c.id, c.component_key
      `,
      [deviceUid, ownerUserId, componentKey]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: "Component not found (or not yours)" });
    }

    return res.json({ ok: true, component_key: delRes.rows[0].component_key });
  } catch (err: any) {
    console.error("DELETE /api/devices/:deviceUid/components/:componentKey failed:", err);
    return res.status(500).json({ error: err.message ?? "Server error" });
  }
});
