import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";



type ClientMeta = {
  deviceUids: Set<string>; // subscriptions
};

const clients = new Map<WebSocket, ClientMeta>();

export function initWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.set(ws, { deviceUids: new Set() });

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
          clients.get(ws)?.deviceUids.add(msg.device_uid);
          ws.send(JSON.stringify({ type: "subscribed", device_uid: msg.device_uid }));
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
  });

  console.log("🧩 WebSocket server ready at ws://localhost:4000/ws");
}

/**
 * Broadcast a component_latest update to all clients subscribed to that device_uid.
 */
export function broadcastComponentLatest(evt: {
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
    if (ws.readyState !== ws.OPEN) continue;
    if (!meta.deviceUids.has(evt.device_uid)) continue;
    ws.send(data);
  }
}

export function broadcastDeviceStatus(evt: {
  device_uid: string;
  is_online: boolean;
  last_seen_at: string | null;
}) {
  const data = JSON.stringify({
    type: "device_status",
    ...evt,
  });

  for (const [ws] of clients.entries()) {
    if (ws.readyState !== ws.OPEN) continue;
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

  for (const [ws] of clients.entries()) {
    if (ws.readyState !== ws.OPEN) continue;
    ws.send(data);
  }
}

export function broadcastComponentStatus(evt: {
  device_uid: string;
  component_key: string;
  is_online: boolean;
  last_seen_at: string | null;
}) {
  const data = JSON.stringify({
    type: "component_status",
    ...evt,
  });

  for (const [ws] of clients.entries()) {
    if (ws.readyState !== ws.OPEN) continue;
    ws.send(data);
  }
}
