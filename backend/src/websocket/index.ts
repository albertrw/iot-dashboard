import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "../db";
import { getSessionUser } from "../auth/sessions";



type ClientMeta = {
  userId: string;
  deviceUids: Set<string>; // subscriptions
};

const clients = new Map<WebSocket, ClientMeta>();

export function initWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    void (async () => {
      const url = new URL(req.url ?? "/ws", "http://localhost");
      const proto = req.headers["sec-websocket-protocol"];
      const tokenFromProto =
        typeof proto === "string" ? proto.split(",")[0]?.trim() : null;
      const token = tokenFromProto || url.searchParams.get("token");

      if (!token) {
        try {
          ws.send(JSON.stringify({ type: "error", error: "Missing token" }));
        } catch {}
        ws.close(1008, "Missing token");
        return;
      }

      const user = await getSessionUser(token);
      if (!user) {
        try {
          ws.send(JSON.stringify({ type: "error", error: "Invalid or expired token" }));
        } catch {}
        ws.close(1008, "Invalid token");
        return;
      }

      clients.set(ws, { userId: user.id, deviceUids: new Set() });

      ws.send(
        JSON.stringify({
          type: "hello",
          message: "connected",
        })
      );

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          // subscribe to one device
          if (msg?.type === "subscribe" && typeof msg.device_uid === "string") {
            const meta = clients.get(ws);
            if (!meta) return;

            const deviceUid = msg.device_uid;
            db.query(`select 1 from devices where device_uid = $1 and owner_user_id = $2 limit 1`, [
              deviceUid,
              meta.userId,
            ])
              .then((r) => {
                if (r.rowCount === 0) {
                  ws.send(JSON.stringify({ type: "error", error: "Not allowed" }));
                  return;
                }
                meta.deviceUids.add(deviceUid);
                ws.send(JSON.stringify({ type: "subscribed", device_uid: deviceUid }));
              })
              .catch(() => {
                ws.send(JSON.stringify({ type: "error", error: "Subscribe failed" }));
              });

            return;
          }

          // unsubscribe
          if (msg?.type === "unsubscribe" && typeof msg.device_uid === "string") {
            clients.get(ws)?.deviceUids.delete(msg.device_uid);
            ws.send(JSON.stringify({ type: "unsubscribed", device_uid: msg.device_uid }));
            return;
          }

          ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
        } catch {
          ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
      });
    })().catch(() => {
      try {
        ws.close(1011, "Auth error");
      } catch {}
    });
  });

  console.log("🧩 WebSocket server ready at ws://localhost:4000/ws");
}

/**
 * Broadcast a component_latest update to all clients subscribed to that device_uid.
 */
export function broadcastComponentLatest(evt: {
  owner_user_id: string;
  device_uid: string;
  component_key: string;
  payload: any;
  updated_at: string; // ISO string
}) {
  const data = JSON.stringify({
    type: "component_latest",
    ...evt,
  });

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (meta.userId !== evt.owner_user_id) continue;
    if (!meta.deviceUids.has(evt.device_uid)) continue;
    ws.send(data);
  }
}

export function broadcastDeviceStatus(evt: {
  owner_user_id: string;
  device_uid: string;
  is_online: boolean;
  last_seen_at: string | null;
}) {
  const data = JSON.stringify({
    type: "device_status",
    ...evt,
  });

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (meta.userId !== evt.owner_user_id) continue;
    ws.send(data);
  }
}

export function broadcastNotification(notification: {
  id: number;
  owner_user_id: string;
  device_uid: string | null;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
}) {
  const data = JSON.stringify({
    type: "notification",
    notification,
  });

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (meta.userId !== notification.owner_user_id) continue;
    ws.send(data);
  }
}

export function broadcastComponentStatus(evt: {
  owner_user_id: string;
  device_uid: string;
  component_key: string;
  is_online: boolean;
  last_seen_at: string | null;
}) {
  const data = JSON.stringify({
    type: "component_status",
    ...evt,
  });

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (meta.userId !== evt.owner_user_id) continue;
    if (!meta.deviceUids.has(evt.device_uid)) continue;
    ws.send(data);
  }
}
