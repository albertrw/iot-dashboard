# ESP8266 + DHT11 firmware (IoT Dashboard)

This sketch connects an ESP8266 to your VPS:
- Claims a device using `POST https://iot.bakamelabs.com/api/devices/claim`
- Connects to Mosquitto over TLS (`mqtt.bakamelabs.com:8883`)
- Publishes a manifest + telemetry in the format your backend expects

## Secure + easy MQTT (recommended)
Use per-device MQTT credentials:
- `username = device_uid`
- `password = device_secret` (returned once during claim, stored on the device)

On the VPS, configure Mosquitto ACLs so each device can only publish/subscribe to its own topics:

Example `/etc/mosquitto/acl`:
```
# Each device user can only access its own topics.
pattern readwrite devices/%u/#

# Optional backend user that can read/write everything (dashboards/monitors).
user iot_backend
topic readwrite devices/#
```

Then, after a device is claimed and you have its `device_secret`, add/update the Mosquitto user:
```
sudo mosquitto_passwd -b /etc/mosquitto/passwd dev_your_device_uid device_secret_from_api
sudo systemctl restart mosquitto
```

## Fully automated provisioning (no manual commands per device)
The backend can auto-create/update Mosquitto users during `POST /api/devices/claim`.

VPS setup:
1) Install the provision script:
```
sudo install -m 0750 -o root -g root /opt/iot-dashboard/deploy/iot-mqtt-provision.sh /usr/local/bin/iot-mqtt-provision
```

2) Allow the backend service user to run it without a password (sudoers):
```
sudo visudo -f /etc/sudoers.d/iot-backend-mqtt
```
Add (replace `albert` if your service runs as another user):
```
albert ALL=(root) NOPASSWD: /usr/local/bin/iot-mqtt-provision
```

3) Enable in backend env:
```
MQTT_PROVISION_ENABLED=true
MQTT_PROVISION_SCRIPT=/usr/local/bin/iot-mqtt-provision
```

## Arduino IDE / PlatformIO requirements
- Board: **ESP8266**
- Libraries:
  - **PubSubClient** (MQTT)
  - **DHT sensor library** (Adafruit) + **Adafruit Unified Sensor** (dependency)

## Wiring (example)
- DHT11 DATA → `D7` (GPIO13) (change `DHT_PIN` if needed)
- DHT11 VCC → 3.3V
- DHT11 GND → GND

## Setup steps
1. In the dashboard, create a new device → copy:
   - `device_uid`
   - `claim_token` (expires quickly; regenerate if needed)
2. Edit config constants at the top of:
   - `firmware/esp8266-dht11/iot_dashboard_esp8266_dht11.ino`
3. Upload to the ESP8266 and open Serial Monitor @ `115200`.

## Topics used
- Manifest: `devices/{device_uid}/meta/components`
- Telemetry:
  - `devices/{device_uid}/telemetry/temp1`
  - `devices/{device_uid}/telemetry/hum1`
- Status (retained): `devices/{device_uid}/status`
