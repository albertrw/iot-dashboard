type WsMessage =
  | { type: "subscribe"; device_uid: string }
  | {
      type: "component_latest";
      device_uid: string;
      component_key: string;
      payload: any;
      updated_at: string;
    }
  | {
      type: "device_status";
      device_uid: string;
      is_online: boolean;
      last_seen_at: string | null;
    }
  | {
      type: "component_status";
      device_uid: string;
      component_key: string;
      is_online: boolean;
      last_seen_at: string | null;
    }
  | {
      type: "notification";
      notification: {
        id: number;
        owner_user_id: string;
        device_uid: string | null;
        title: string;
        body: string;
        type: string;
        read_at: string | null;
        created_at: string;
      };
    };

type Listener = (msg: WsMessage) => void;

function readToken() {
  try {
    return localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

export class WsClient {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private subscribed = new Set<string>();
  private reconnectTimer: number | null = null;
  private backoffMs = 500;

  constructor(url: string) {
    this.url = url;
  }

  private canConnect() {
    return Boolean(readToken());
  }

  connect() {
    const token = readToken();
    if (!token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(this.url, token);

    this.ws.onopen = () => {
      this.backoffMs = 500;
      // resubscribe
      for (const uid of this.subscribed) {
        this.send({ type: "subscribe", device_uid: uid });
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMessage;
        for (const l of this.listeners) l(msg);
      } catch {
        // ignore bad frames
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // close triggers reconnect path
      try { this.ws?.close(); } catch {}
    };
  }

  private scheduleReconnect() {
    if (!this.canConnect()) return;
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.backoffMs = Math.min(this.backoffMs * 2, 8000);
    }, this.backoffMs);
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribe(deviceUid: string) {
    this.subscribed.add(deviceUid);
    this.connect();
    this.send({ type: "subscribe", device_uid: deviceUid });
  }

  private send(msg: WsMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  close() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}
