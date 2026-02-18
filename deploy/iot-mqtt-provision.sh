#!/usr/bin/env bash
set -euo pipefail

DEVICE_UID="${1:-}"
DEVICE_SECRET="${2:-}"

if [[ -z "$DEVICE_UID" || -z "$DEVICE_SECRET" ]]; then
  echo "Usage: iot-mqtt-provision <device_uid> <device_secret>" >&2
  exit 2
fi

if ! [[ "$DEVICE_UID" =~ ^dev_[0-9a-fA-F]{16}$ ]]; then
  echo "Invalid device_uid: $DEVICE_UID" >&2
  exit 3
fi

if ! [[ "$DEVICE_SECRET" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Invalid device_secret format" >&2
  exit 4
fi

PASSWD_FILE="/etc/mosquitto/passwd"

if [[ ! -f "$PASSWD_FILE" ]]; then
  echo "Missing $PASSWD_FILE" >&2
  exit 5
fi

mosquitto_passwd -b "$PASSWD_FILE" "$DEVICE_UID" "$DEVICE_SECRET" >/dev/null

# Reload mosquitto so it re-reads the password file.
if systemctl reload mosquitto >/dev/null 2>&1; then
  exit 0
fi
systemctl restart mosquitto >/dev/null

