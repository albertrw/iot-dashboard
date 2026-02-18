#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <ESP8266HTTPClient.h>
#include <PubSubClient.h>
#include <EEPROM.h>
#include <DHT.h>
#include <time.h>

// ===========================
// DEBUG / TLS OPTIONS
// ===========================
// Set to 1 to print TLS errors when MQTT connect fails.
#define DEBUG_TLS 1

// Temporary troubleshooting only:
// If set to 1, TLS certificate validation is disabled.
// DO NOT ship devices with this enabled.
#define MQTT_TLS_INSECURE 0

// ===========================
// USER CONFIG (EDIT THESE)
// ===========================
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Create a device in the dashboard -> copy device_uid + claim_token.
const char* DEVICE_UID = "dev_your_device_uid";
const char* CLAIM_TOKEN = "claim_token_from_dashboard";

// API is behind Nginx on your VPS
const char* API_HOST = "iot.bakamelabs.com"; // no https://

// MQTT broker on your VPS
const char* MQTT_HOST = "mqtt.bakamelabs.com";
const int MQTT_PORT = 8883; // TLS

// Secure mode (recommended):
// - MQTT username = DEVICE_UID
// - MQTT password = device_secret returned by claim (stored in EEPROM)

// DHT11 wiring
// - DATA -> D7 (GPIO13)
// - VCC  -> 3.3V
// - GND  -> GND
const int DHT_PIN = D7;
const int DHT_TYPE = DHT11;

// Publish interval (DHT11 is slow; don’t read too often)
const unsigned long TELEMETRY_MS = 5000;

// ===========================
// TLS: Let's Encrypt Root CA
// ===========================
// This is the ISRG Root X1 certificate (Let's Encrypt). It’s public.
// If TLS fails on your ESP8266, check that NTP time sync is working.
static const char LE_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

BearSSL::X509List rootCert(LE_ROOT_CA);

BearSSL::WiFiClientSecure httpsNet;
BearSSL::WiFiClientSecure mqttNet;
PubSubClient mqtt(mqttNet);

DHT dht(DHT_PIN, DHT_TYPE);

// ===========================
// EEPROM storage (device_secret)
// ===========================
const int EEPROM_SIZE = 512;
const int MAGIC_ADDR = 0;
const int SECRET_ADDR = 8;
const int SECRET_MAX = 80; // device_secret is 64 hex chars
const uint32_t MAGIC = 0xBEEFF00D;

unsigned long lastTelemetry = 0;
String deviceSecret = "";
unsigned long nextProvisionAttemptAt = 0;

String topicManifest() {
  return "devices/" + String(DEVICE_UID) + "/meta/components";
}
String topicTelemetry(const char* componentKey) {
  return "devices/" + String(DEVICE_UID) + "/telemetry/" + String(componentKey);
}
String topicStatus() {
  return "devices/" + String(DEVICE_UID) + "/status";
}

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

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("NTP time sync");

  time_t now = time(nullptr);
  while (now < 1700000000) { // sanity (2023+)
    delay(400);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();
  Serial.print("Time OK: ");
  Serial.println(ctime(&now));

  httpsNet.setTrustAnchors(&rootCert);
  mqttNet.setTrustAnchors(&rootCert);
  httpsNet.setX509Time(now);
  mqttNet.setX509Time(now);

  // Reduce TLS buffer sizes to fit on ESP8266 (prevents BearSSL OOM).
  // If you still see TLS OOM errors, try lowering MQTT buffer size too.
  httpsNet.setBufferSizes(4096, 1024);
  mqttNet.setBufferSizes(4096, 1024);

#if MQTT_TLS_INSECURE
  httpsNet.setInsecure();
  mqttNet.setInsecure();
#endif
}

String extractJsonString(const String& json, const char* key) {
  // Very small helper for {"key":"value"} responses.
  String needle = String("\"") + key + "\":\"";
  int start = json.indexOf(needle);
  if (start < 0) return "";
  start += needle.length();
  int end = json.indexOf("\"", start);
  if (end < 0) return "";
  return json.substring(start, end);
}

String claimDeviceGetSecret() {
  HTTPClient http;

  // If you want quick testing (NOT recommended), you can disable TLS validation:
  // httpsNet.setInsecure();

  String url = String("https://") + API_HOST + "/api/devices/claim";
  Serial.print("Claiming via: ");
  Serial.println(url);

  if (!http.begin(httpsNet, url)) {
    Serial.println("HTTP begin failed");
    return "";
  }

  http.addHeader("Content-Type", "application/json");
  char body[220];
  snprintf(
    body,
    sizeof(body),
    "{\"device_uid\":\"%s\",\"claim_token\":\"%s\"}",
    DEVICE_UID,
    CLAIM_TOKEN
  );

  int code = http.POST((uint8_t*)body, strlen(body));
  String resp = http.getString();
  http.end();
  httpsNet.stop();

  Serial.print("Claim HTTP code: ");
  Serial.println(code);
  Serial.print("Claim response: ");
  Serial.println(resp);

  if (code < 200 || code >= 300) return "";
  return extractJsonString(resp, "device_secret");
}

bool provisionMqttCredentials() {
  if (deviceSecret.length() == 0) return false;

  HTTPClient http;
  String url = String("https://") + API_HOST + "/api/devices/provision-mqtt";
  Serial.print("Provision MQTT via: ");
  Serial.println(url);

  if (!http.begin(httpsNet, url)) {
    Serial.println("HTTP begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  char body[220];
  snprintf(
    body,
    sizeof(body),
    "{\"device_uid\":\"%s\",\"device_secret\":\"%s\"}",
    DEVICE_UID,
    deviceSecret.c_str()
  );

  int code = http.POST((uint8_t*)body, strlen(body));
  String resp = http.getString();
  http.end();
  httpsNet.stop();

  Serial.print("Provision HTTP code: ");
  Serial.println(code);
  if (code >= 200 && code < 300) {
    Serial.println("Provision OK");
    return true;
  }

  Serial.print("Provision response: ");
  Serial.println(resp);
  return false;
}

void publishManifest() {
  String payload =
    String("{\"components\":[") +
    String("{\"key\":\"temp1\",\"kind\":\"sensor\",\"name\":\"Temperature\",\"capabilities\":{\"unit\":\"C\"}},") +
    String("{\"key\":\"hum1\",\"kind\":\"sensor\",\"name\":\"Humidity\",\"capabilities\":{\"unit\":\"%\"}}") +
    String("]}");

  String t = topicManifest();
  mqtt.publish(t.c_str(), payload.c_str(), false);
  Serial.println("Published manifest");
}

void publishStatus(bool online) {
  String t = topicStatus();
  String payload = online ? String("{\"state\":\"online\"}") : String("{\"state\":\"offline\"}");
  mqtt.publish(t.c_str(), payload.c_str(), true); // retained
}

void mqttConnect() {
  if (deviceSecret.length() == 0) {
    Serial.println("Missing device_secret. Cannot connect to MQTT.");
    return;
  }

  mqttNet.setTimeout(15);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512); // keep small to save RAM (manifest/telemetry are small)

  while (!mqtt.connected()) {
    Serial.print("MQTT connecting to ");
    Serial.print(MQTT_HOST);
    Serial.print(":");
    Serial.print(MQTT_PORT);
    Serial.print(" ... ");

    const String statusTopic = topicStatus();

    // clientId = DEVICE_UID, username = DEVICE_UID, password = deviceSecret
    bool ok = mqtt.connect(
      DEVICE_UID,
      DEVICE_UID,
      deviceSecret.c_str(),
      statusTopic.c_str(),
      0,     // will QoS
      true,  // will retain
      "{\"state\":\"offline\"}"
    );
    if (ok) {
      Serial.println("OK");
      publishStatus(true);
      publishManifest();
      return;
    }

#if DEBUG_TLS
    char tlsErr[160];
    int tlsCode = mqttNet.getLastSSLError(tlsErr, sizeof(tlsErr));
    if (tlsCode != 0) {
      Serial.print("TLS error code: ");
      Serial.println(tlsCode);
      Serial.print("TLS error: ");
      Serial.println(tlsErr);
    }
#endif

    Serial.print("failed, state=");
    Serial.println(mqtt.state());

    // state=5 => not authorized (credentials/ACL). Try provisioning with backoff.
    if (mqtt.state() == 5) {
      const unsigned long nowMs = millis();
      if (nowMs >= nextProvisionAttemptAt) {
        Serial.println("Trying to provision MQTT credentials...");
        provisionMqttCredentials();
        nextProvisionAttemptAt = nowMs + 60000; // try again in 60s
      }
    }

    delay(1500);
  }
}

void publishTelemetry() {
  float h = dht.readHumidity();
  float t = dht.readTemperature(); // Celsius

  if (isnan(h) || isnan(t)) {
    Serial.println("DHT read failed");
    return;
  }

  String tempPayload = String("{\"value\":") + String(t, 1) + ",\"unit\":\"C\"}";
  String humPayload = String("{\"value\":") + String(h, 0) + ",\"unit\":\"%\"}";

  mqtt.publish(topicTelemetry("temp1").c_str(), tempPayload.c_str(), false);
  mqtt.publish(topicTelemetry("hum1").c_str(), humPayload.c_str(), false);
}

void setup() {
  Serial.begin(115200);
  delay(200);

  EEPROM.begin(EEPROM_SIZE);
  dht.begin();

  connectWiFi();
  syncTime();

  // Claim once (optional but recommended so device becomes active in DB)
  if (!eepromHasSecret()) {
    Serial.println("No saved device_secret. Claiming...");
    const String secret = claimDeviceGetSecret();
    if (secret.length() > 0) {
      eepromWriteSecret(secret);
      Serial.println("Claim OK. Saved device_secret to EEPROM.");
    } else {
      Serial.println("Claim failed. MQTT auth will not work until claim succeeds.");
    }
  } else {
    Serial.println("device_secret already saved in EEPROM.");
  }

  deviceSecret = eepromReadSecret();
  if (deviceSecret.length() == 0) {
    Serial.println("device_secret is empty. Check claim token and try again.");
    return;
  }

  mqttConnect();
}

void loop() {
  if (!mqtt.connected()) {
    mqttConnect();
  }
  mqtt.loop();

  if (millis() - lastTelemetry >= TELEMETRY_MS) {
    lastTelemetry = millis();
    publishTelemetry();
    publishStatus(true); // heartbeat keeps the device online
  }
}
