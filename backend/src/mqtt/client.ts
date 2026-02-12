import "dotenv/config";
import mqtt, { type IClientOptions } from "mqtt";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";

const options: IClientOptions = {
  connectTimeout: 10_000,
  reconnectPeriod: 2_000,
  keepalive: 30,
};

export const mqttClient = mqtt.connect(MQTT_URL, options);

mqttClient.on("connect", () => {
  console.log("✅ MQTT publisher connected");
});

mqttClient.on("reconnect", () => {
  console.log("↻ MQTT publisher reconnecting...");
});

mqttClient.on("offline", () => {
  console.log("⚠️ MQTT publisher offline");
});

mqttClient.on("close", () => {
  console.log("MQTT publisher connection closed");
});

mqttClient.on("error", (err) => {
  console.error("MQTT publisher error:", err);
});
