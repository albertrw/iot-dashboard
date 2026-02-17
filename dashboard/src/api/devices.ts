import { api } from "./client";

export type Device = {
  id: string;
  device_uid: string;
  name?: string;
  description?: string;
  status?: string;
  last_seen_at?: string;
  is_online?: boolean;
};


export type ComponentKind = "sensor" | "actuator";

export type Component = {
  id: string;
  device_id: string;
  component_key: string;
  kind: ComponentKind;
  capabilities: Record<string, any>;
  meta?: Record<string, any>;
  name?: string; // if you store it in meta, map it in UI
  is_online?: boolean;
  last_seen_at?: string | null;
};

export type ComponentLatest = {
  component_key: string;
  payload: Record<string, any>;
  updated_at: string;
};

export async function listDevices(): Promise<Device[]> {
  return api<Device[]>("/api/devices");
}

// Recommended backend endpoint for UI convenience:
// GET /api/devices/:deviceUid -> { device, components, latest: { [component_key]: {payload, updated_at} } }
export type DeviceDetail = {
  device: Device;
  components: Component[];
  latest: Record<string, { payload: any; updated_at: string }>;
};

export async function getDeviceDetail(deviceUid: string): Promise<DeviceDetail> {
  return api<DeviceDetail>(`/api/devices/${encodeURIComponent(deviceUid)}`);
}

export async function sendCommand(params: {
  deviceUid: string;
  component_key: string;
  command: any;
}): Promise<void> {
  const { deviceUid, component_key, command } = params;
  await api<void>(`/api/devices/${encodeURIComponent(deviceUid)}/commands`, {
    method: "POST",
    body: JSON.stringify({ component_key, command }),
  });
}

// Create device (already exists in backend)
export async function createDevice(input: { name?: string; description?: string }) {
  return api<{
    device_uid: string;
    claim_token: string;
    claim_expires_at: string;
  }>("/api/devices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateDevice(deviceUid: string, input: { name?: string; description?: string }) {
  return api<Device>(`/api/devices/${encodeURIComponent(deviceUid)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteDevice(deviceUid: string) {
  return api<void>(`/api/devices/${encodeURIComponent(deviceUid)}`, {
    method: "DELETE",
  });
}

export async function updateComponentMeta(
  deviceUid: string,
  componentKey: string,
  input: { name?: string; hidden?: boolean; visual?: string }
) {
  return api(
    `/api/devices/${encodeURIComponent(deviceUid)}/components/${encodeURIComponent(componentKey)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function deleteComponent(deviceUid: string, componentKey: string) {
  return api<{ ok: true; component_key: string }>(
    `/api/devices/${encodeURIComponent(deviceUid)}/components/${encodeURIComponent(componentKey)}`,
    {
      method: "DELETE",
    }
  );
}

export async function regenerateClaimToken(deviceUid: string) {
  return api<{
    device_uid: string;
    claim_token: string;
    claim_expires_at: string;
  }>(`/api/devices/${encodeURIComponent(deviceUid)}/claim-token`, {
    method: "POST",
  });
}
