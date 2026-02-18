import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function enabled() {
  return String(process.env.MQTT_PROVISION_ENABLED ?? "").toLowerCase() === "true";
}

function provisionScriptPath() {
  return process.env.MQTT_PROVISION_SCRIPT ?? "/usr/local/bin/iot-mqtt-provision";
}

function isDeviceUid(v: string) {
  return /^dev_[0-9a-f]{16}$/i.test(v);
}

function isDeviceSecret(v: string) {
  return /^[0-9a-f]{64}$/i.test(v);
}

export async function provisionMqttUser(params: {
  device_uid: string;
  device_secret: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!enabled()) return { ok: true };

  const deviceUid = params.device_uid;
  const deviceSecret = params.device_secret;

  if (!isDeviceUid(deviceUid)) {
    return { ok: false, error: "Invalid device_uid format" };
  }
  if (!isDeviceSecret(deviceSecret)) {
    return { ok: false, error: "Invalid device_secret format" };
  }

  const script = provisionScriptPath();

  try {
    // Use sudo non-interactively. Configure /etc/sudoers.d/ to allow this script.
    await execFileAsync("sudo", ["-n", script, deviceUid, deviceSecret], {
      timeout: 15_000,
      windowsHide: true,
      maxBuffer: 1024 * 64,
      env: {
        ...process.env,
      },
    });

    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message ?? "Provisioning failed");
    return { ok: false, error: msg };
  }
}

