import { CodeBlock } from "../components/ui/CodeBlock";

const claimCurl = String.raw`curl -X POST http://<api-host>:4000/api/devices/claim \
  -H "Content-Type: application/json" \
  -d '{"device_uid":"dev_your_device_uid","claim_token":"claim_token_from_dashboard"}'`;

const claimResponse = String.raw`{
  "device_uid": "dev_your_device_uid",
  "device_secret": "device_secret_from_api"
}`;

const mqttTopics = String.raw`devices/{device_uid}/meta/components
devices/{device_uid}/telemetry/{component_key}
devices/{device_uid}/command/{component_key}
devices/{device_uid}/status`;

const manifestExample = String.raw`{
  "components": [
    {
      "key": "distance1",
      "kind": "sensor",
      "name": "Front Distance",
      "capabilities": { "unit": "cm" }
    },
    {
      "key": "led1",
      "kind": "actuator",
      "name": "Onboard LED",
      "capabilities": { "commands": ["on", "off"] }
    }
  ]
}`;

const telemetrySensor = String.raw`{
  "value": 24,
  "unit": "cm"
}`;

const telemetryActuator = String.raw`{
  "state": "on"
}`;

const commandExample = String.raw`{
  "state": "on"
}`;

const statusPayload = String.raw`{"state":"online"}`;

const lwtSnippet = String.raw`// MQTT status (recommended)
const char* STATUS_TOPIC = "devices/{device_uid}/status";
mqtt.setWill(STATUS_TOPIC, "{\"state\":\"offline\"}", true, 0);

// after connect
mqtt.publish(STATUS_TOPIC, "{\"state\":\"online\"}", true);`;

const heartbeatSnippet = String.raw`// Send a heartbeat every 5s to keep device online
const unsigned long STATUS_PUBLISH_MS = 5000;
unsigned long lastStatus = 0;

if (mqtt.connected() && millis() - lastStatus >= STATUS_PUBLISH_MS) {
  lastStatus = millis();
  mqtt.publish(STATUS_TOPIC, "{\"state\":\"online\"}", true);
}`;

const mqttAuthSnippet = String.raw`// MQTT connect (username = device_uid, password = device_secret)
mqtt.connect(DEVICE_UID, DEVICE_UID, deviceSecret.c_str());`;

const manifestRuleSnippet = String.raw`// Publish manifest on boot + every MQTT reconnect
publishManifest();`;

const telemetryRuleSnippet = String.raw`// Telemetry must include component_key and payload
// Topic: devices/{uid}/telemetry/{component_key}
{"value": 24, "unit": "cm"}`;

const commandRuleSnippet = String.raw`// Commands are JSON sent to actuator topics
// Topic: devices/{uid}/command/{component_key}
{"state":"on"}`;

const storageSnippet = String.raw`// Store device_secret after claim (EEPROM or NVS)
if (!secretSaved) {
  secret = claimDevice();
  saveSecret(secret);
}`;

const firmwareSkeleton = String.raw`// 1) Connect Wi-Fi
// 2) Claim device once -> save device_secret
// 3) MQTT connect with device_uid + device_secret
// 4) Publish manifest on every reconnect
// 5) Telemetry loop + command handler

connectWiFi();
if (!secretSaved) {
  secret = claimDevice();
  saveSecret(secret);
}

mqttConnect(deviceUid, secret);
mqttSubscribe("devices/{uid}/command/{component_key}");
publishManifest();

loop {
  mqtt.loop();
  publishTelemetry();
  handleCommands();
}`;

const fullFirmware = String.raw`#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <EEPROM.h>
#include <PubSubClient.h>

// ---------------------------
// USER CONFIG (placeholders)
// ---------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* DEVICE_UID   = "dev_your_device_uid";
const char* CLAIM_TOKEN  = "claim_token_from_dashboard";

const char* API_HOST = "YOUR_API_HOST";
const int   API_PORT = 4000;

const char* MQTT_HOST = "YOUR_MQTT_HOST";
const int   MQTT_PORT = 1883;

// Components
const char* DIST_COMPONENT_KEY = "distance1";
const char* LED_COMPONENT_KEY  = "led1";

// HC-SR04 pins (safe)
const int TRIG_PIN = D5;
const int ECHO_PIN = D6;

const unsigned long PUBLISH_MS = 500;

// ---------------------------
// EEPROM
// ---------------------------
const int EEPROM_SIZE = 512;
const int MAGIC_ADDR  = 0;
const int SECRET_ADDR = 8;
const int SECRET_MAX  = 128;
const uint32_t MAGIC  = 0xBEEFF00D;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPub = 0;
bool ledStateOn = false; // logical LED state

// ---------------------------
// Topic helpers
// ---------------------------
String topicTelemetry(const char* componentKey) {
  return "devices/" + String(DEVICE_UID) + "/telemetry/" + String(componentKey);
}

String topicCommand(const char* componentKey) {
  return "devices/" + String(DEVICE_UID) + "/command/" + String(componentKey);
}

String topicManifest() {
  return "devices/" + String(DEVICE_UID) + "/meta/components";
}

// ---------------------------
// EEPROM helpers
// ---------------------------
bool eepromHasSecret() {
  uint32_t m = 0;
  EEPROM.get(MAGIC_ADDR, m);
  return (m == MAGIC);
}

String eepromReadSecret() {
  char buf[SECRET_MAX + 1];
  for (int i = 0; i < SECRET_MAX; i++) {
    buf[i] = char(EEPROM.read(SECRET_ADDR + i));
    if (buf[i] == '\0') break;
  }
  buf[SECRET_MAX] = '\0';
  return String(buf);
}

void eepromWriteSecret(const String& secret) {
  uint32_t m = MAGIC;
  EEPROM.put(MAGIC_ADDR, m);

  for (int i = 0; i < SECRET_MAX; i++) EEPROM.write(SECRET_ADDR + i, 0);

  int n = secret.length();
  if (n > SECRET_MAX - 1) n = SECRET_MAX - 1;
  for (int i = 0; i < n; i++) EEPROM.write(SECRET_ADDR + i, secret[i]);
  EEPROM.write(SECRET_ADDR + n, 0);

  EEPROM.commit();
}

// ---------------------------
// Wi-Fi + Claim
// ---------------------------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi OK, IP: ");
  Serial.println(WiFi.localIP());
}

String claimDeviceGetSecret() {
  WiFiClient client;
  HTTPClient http;

  String url = String("http://") + API_HOST + ":" + API_PORT + "/api/devices/claim";
  Serial.print("Claiming via: ");
  Serial.println(url);

  if (!http.begin(client, url)) {
    Serial.println("HTTP begin failed");
    return "";
  }

  http.addHeader("Content-Type", "application/json");

  String body = String("{\"device_uid\":\"") + DEVICE_UID +
                String("\",\"claim_token\":\"") + CLAIM_TOKEN + "\"}";

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.print("Claim HTTP code: ");
  Serial.println(code);
  Serial.print("Claim response: ");
  Serial.println(resp);

  if (code != 200) return "";

  int idx = resp.indexOf("\"device_secret\"");
  if (idx < 0) return "";
  int colon = resp.indexOf(":", idx);
  int q1 = resp.indexOf("\"", colon);
  int q2 = resp.indexOf("\"", q1 + 1);
  if (q1 < 0 || q2 < 0) return "";

  return resp.substring(q1 + 1, q2);
}

// ---------------------------
// Sensor
// ---------------------------
long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  if (duration == 0) return -1;

  return (long)(duration / 58);
}

// ---------------------------
// LED actuator
// ---------------------------
// NOTE: NodeMCU built-in LED is usually ACTIVE-LOW:
// LOW = ON, HIGH = OFF
void setLed(bool on) {
  ledStateOn = on;
  digitalWrite(LED_BUILTIN, on ? LOW : HIGH);

  String payload = on ? "{\"state\":\"on\"}" : "{\"state\":\"off\"}";
  String t = topicTelemetry(LED_COMPONENT_KEY);
  mqtt.publish(t.c_str(), payload.c_str(), false);

  Serial.print("LED set to ");
  Serial.println(on ? "ON" : "OFF");
}

// ---------------------------
// MQTT
// ---------------------------
void publishManifest() {
  // This tells backend/dashboard what components exist + how to render them
  String payload =
    "{\"components\":["
      "{\"key\":\"distance1\",\"kind\":\"sensor\",\"name\":\"Front Distance\",\"capabilities\":{\"unit\":\"cm\"}},"
      "{\"key\":\"led1\",\"kind\":\"actuator\",\"name\":\"Onboard LED\",\"capabilities\":{\"commands\":[\"on\",\"off\"]}}"
    "]}";

  String t = topicManifest();
  mqtt.publish(t.c_str(), payload.c_str(), false);
  Serial.println("Published manifest");
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String t = String(topic);
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("CMD ");
  Serial.print(t);
  Serial.print(" => ");
  Serial.println(msg);

  // Handle LED actuator commands on devices/{uid}/command/led1
  if (t == topicCommand(LED_COMPONENT_KEY)) {
    // Expect {"state":"on"} / {"state":"off"}
    if (msg.indexOf("\"state\"") >= 0 && msg.indexOf("on") >= 0) {
      setLed(true);
    } else if (msg.indexOf("\"state\"") >= 0 && msg.indexOf("off") >= 0) {
      setLed(false);
    }
  }
}

void mqttEnsureConnected(const String& secret) {
  if (mqtt.connected()) return;

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);

  while (!mqtt.connected()) {
    Serial.print("MQTT connecting as ");
    Serial.print(DEVICE_UID);
    Serial.print(" ... ");

    bool ok = mqtt.connect(DEVICE_UID, DEVICE_UID, secret.c_str());
    if (ok) {
      Serial.println("OK");

      // Subscribe to actuator command topics
      mqtt.subscribe(topicCommand(LED_COMPONENT_KEY).c_str());
      Serial.println("Subscribed to LED commands");

      // Announce components
      publishManifest();

      // Report current LED state
      setLed(false);
    } else {
      Serial.print("FAIL rc=");
      Serial.println(mqtt.state());
      delay(1500);
    }
  }
}

void publishDistanceTelemetry(long cm) {
  String payload = String("{\"value\":") + cm + ",\"unit\":\"cm\"}";
  String t = topicTelemetry(DIST_COMPONENT_KEY);

  bool ok = mqtt.publish(t.c_str(), payload.c_str(), false);
  Serial.print("PUB ");
  Serial.print(t);
  Serial.print(" => ");
  Serial.println(ok ? payload : "FAILED");
}

// ---------------------------
// Arduino lifecycle
// ---------------------------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nBOOT: IoT firmware start");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // OFF

  EEPROM.begin(EEPROM_SIZE);

  connectWiFi();

  String secret;
  if (eepromHasSecret()) {
    secret = eepromReadSecret();
    Serial.print("Found saved device_secret (len=");
    Serial.print(secret.length());
    Serial.println(")");
  }

  if (!eepromHasSecret() || secret.length() < 10) {
    Serial.println("No valid secret saved; claiming now...");
    secret = claimDeviceGetSecret();
    if (secret.length() < 10) {
      Serial.println("[ERROR] Claim failed (token expired or wrong host/port).");
      delay(5000);
      ESP.restart();
    }
    eepromWriteSecret(secret);
    Serial.println("[OK] Secret saved to EEPROM.");
  }

  mqttEnsureConnected(secret);
}

void loop() {
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastPub >= PUBLISH_MS) {
    lastPub = now;

    String secret = eepromReadSecret();
    mqttEnsureConnected(secret);

    long cm = readDistanceCm();
    if (cm > 0) publishDistanceTelemetry(cm);
    else Serial.println("Sensor read timeout / invalid.");
  }
}`;

export function TechniciansGuidePage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-500 dark:text-white/60">Docs</div>
        <h1 className="text-xl font-semibold">Technicians Guide</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-white/70">
          Configure devices using claim, manifest, telemetry, and commands.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Overview (3 steps)
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Claim once with REST and store the device_secret locally.</li>
          <li>Publish a manifest so the platform discovers components.</li>
          <li>Send telemetry and listen for commands on MQTT topics.</li>
        </ol>
        <div className="text-sm text-gray-600 dark:text-white/70">
          UI renaming/hiding only changes metadata. Add/remove sensors in firmware manifest.
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Claim + device secret (required)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Claim only once per device.</li>
          <li>Store device_secret in EEPROM/NVS for future reconnects.</li>
          <li>Do not re-claim on every boot.</li>
        </ul>
        <CodeBlock title="Claim request (HTTP)" code={claimCurl} language="bash" />
        <CodeBlock title="Claim response" code={claimResponse} language="json" />
        <CodeBlock title="Store secret" code={storageSnippet} language="cpp" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          MQTT authentication (required)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Connect with username = device_uid, password = device_secret.</li>
          <li>Reconnect on Wi‑Fi or broker drop.</li>
        </ul>
        <CodeBlock title="MQTT connect" code={mqttAuthSnippet} language="cpp" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          MQTT topic reference
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Manifest topic is required on boot and reconnect.</li>
          <li>Telemetry topics are per component_key.</li>
          <li>Commands are sent to actuator topics only.</li>
          <li>Status topic enables fast offline detection (recommended).</li>
        </ul>
        <CodeBlock title="Topics" code={mqttTopics} language="txt" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Manifest (required)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Publish manifest on every boot and MQTT reconnect.</li>
          <li>Use stable component keys (do not rename keys in firmware).</li>
        </ul>
        <CodeBlock title="Publish rule" code={manifestRuleSnippet} language="cpp" />
        <CodeBlock title="Manifest payload" code={manifestExample} language="json" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Telemetry (required)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Topic must include component_key.</li>
          <li>Sensors should publish every few seconds.</li>
        </ul>
        <CodeBlock title="Telemetry rule" code={telemetryRuleSnippet} language="json" />
        <CodeBlock title="Sensor telemetry" code={telemetrySensor} language="json" />
        <CodeBlock title="Actuator state telemetry" code={telemetryActuator} language="json" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Commands (actuators)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Only actuator components should accept commands.</li>
          <li>Echo actuator state back to telemetry after executing.</li>
        </ul>
        <CodeBlock title="Command rule" code={commandRuleSnippet} language="json" />
        <CodeBlock title="Actuator command" code={commandExample} language="json" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Online/offline status (required for fast detection)
        </h2>
        <div className="text-sm text-gray-600 dark:text-white/70">
          Publish online on connect and set an MQTT LWT to publish offline on disconnect. Add
          a heartbeat to keep the device online even if sensors stop sending telemetry.
        </div>
        <CodeBlock title="Status payload" code={statusPayload} language="json" />
        <CodeBlock title="MQTT LWT snippet" code={lwtSnippet} language="cpp" />
        <CodeBlock title="Heartbeat snippet" code={heartbeatSnippet} language="cpp" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Component offline detection (sensors)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Components are marked offline if telemetry stops for 20s.</li>
          <li>Actuators may not publish often, so status is device‑level.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          ESP8266/ESP32 firmware skeleton
        </h2>
        <CodeBlock title="Firmware flow" code={firmwareSkeleton} language="cpp" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Full firmware example
        </h2>
        <CodeBlock title="Full sketch" code={fullFirmware} language="cpp" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-white/70">
          Common mistakes checklist
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-white/80">
          <li>Not publishing the manifest after every MQTT reconnect.</li>
          <li>Changing component_key values for the same physical component.</li>
          <li>Setting actuator components with kind=sensor.</li>
          <li>Forgetting to echo actuator state to telemetry.</li>
          <li>Re-claiming instead of storing device_secret.</li>
        </ul>
      </section>
    </div>
  );
}
