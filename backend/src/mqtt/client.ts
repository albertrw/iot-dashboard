import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://192.168.1.68:1883";

export const mqttClient = mqtt.connect(MQTT_URL);

mqttClient.on("connect", () => {
  console.log("✅ MQTT publisher connected");
});

mqttClient.on("error", (err) => {
  console.error("MQTT publisher error:", err);
});
