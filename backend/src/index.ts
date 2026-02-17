import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import "./mqtt";
import { authRouter } from "./api/auth";
import { devicesRouter } from "./api/devices";
import { notificationsRouter } from "./api/notifications";
import { initWebSocket } from "./websocket";
import { startOfflineMonitor } from "./monitor/offlineMonitor";
import { startComponentOfflineMonitor } from "./monitor/componentOfflineMonitor";
import { startComponentAutoHideMonitor } from "./monitor/componentAutoHide";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/notifications", notificationsRouter);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

// Create HTTP server so WS + Express share the same port
const server = http.createServer(app);

// Start WebSocket server on /ws
initWebSocket(server);
startOfflineMonitor();
startComponentOfflineMonitor();
startComponentAutoHideMonitor();

server.listen(port, host, () => {
  console.log(`🚀 API listening on http://${host}:${port}`);
});
