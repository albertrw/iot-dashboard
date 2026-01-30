import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Component, Device, DeviceDetail } from "../api/devices";
import {
  getDeviceDetail,
  listDevices,
  createDevice as apiCreateDevice,
  updateDevice as apiUpdateDevice,
  deleteDevice as apiDeleteDevice,
} from "../api/devices";
import { WsClient } from "../ws/wsClient";

type State = {
  devices: Device[];
  devicesLoading: boolean;
  deviceDetails: Record<
    string,
    {
      device?: Device;
      components: Component[];
      latest: Record<string, { payload: any; updated_at: string }>;
      loading: boolean;
      error?: string;
    }
  >;
};

type Action =
  | { type: "devices_loading" }
  | { type: "devices_loaded"; devices: Device[] }
  | { type: "devices_failed"; error: string }
  | { type: "device_loading"; deviceUid: string }
  | { type: "device_loaded"; deviceUid: string; detail: DeviceDetail }
  | { type: "device_error"; deviceUid: string; error: string }
  | { type: "device_updated"; device: Device }
  | { type: "device_deleted"; deviceUid: string }
  | { type: "device_status"; device_uid: string; is_online: boolean; last_seen_at: string | null }
  | {
      type: "component_status";
      device_uid: string;
      component_key: string;
      is_online: boolean;
      last_seen_at: string | null;
    }
  | {
      type: "component_latest";
      device_uid: string;
      component_key: string;
      payload: any;
      updated_at: string;
    };

const initialState: State = {
  devices: [],
  devicesLoading: false,
  deviceDetails: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "devices_loading":
      return { ...state, devicesLoading: true };

    case "devices_loaded":
      return { ...state, devicesLoading: false, devices: action.devices };

    case "devices_failed":
      return { ...state, devicesLoading: false };

    case "device_loading": {
      const prev = state.deviceDetails[action.deviceUid];
      return {
        ...state,
        deviceDetails: {
          ...state.deviceDetails,
          [action.deviceUid]: {
            device: prev?.device,
            components: prev?.components ?? [],
            latest: prev?.latest ?? {},
            loading: true,
            error: undefined,
          },
        },
      };
    }

    case "device_loaded":
      return {
        ...state,
        deviceDetails: {
          ...state.deviceDetails,
          [action.deviceUid]: {
            device: action.detail.device,
            components: action.detail.components,
            latest: action.detail.latest,
            loading: false,
            error: undefined,
          },
        },
      };

    case "device_error": {
      const prev = state.deviceDetails[action.deviceUid];
      return {
        ...state,
        deviceDetails: {
          ...state.deviceDetails,
          [action.deviceUid]: {
            device: prev?.device,
            components: prev?.components ?? [],
            latest: prev?.latest ?? {},
            loading: false,
            error: action.error,
          },
        },
      };
    }

    case "device_updated": {
      // update list
      const devices = state.devices.map((d) =>
        d.device_uid === action.device.device_uid ? action.device : d
      );

      // update any open detail
      const dd = state.deviceDetails[action.device.device_uid];
      const deviceDetails = dd
        ? {
            ...state.deviceDetails,
            [action.device.device_uid]: { ...dd, device: action.device },
          }
        : state.deviceDetails;

      return { ...state, devices, deviceDetails };
    }

    case "device_deleted": {
      const devices = state.devices.filter((d) => d.device_uid !== action.deviceUid);
      const deviceDetails = { ...state.deviceDetails };
      delete deviceDetails[action.deviceUid];
      return { ...state, devices, deviceDetails };
    }

    case "device_status": {
      const devices = state.devices.map((d) =>
        d.device_uid === action.device_uid
          ? { ...d, is_online: action.is_online, last_seen_at: action.last_seen_at ?? d.last_seen_at }
          : d
      );

      const dd = state.deviceDetails[action.device_uid];
      const deviceDetails = dd
        ? {
            ...state.deviceDetails,
            [action.device_uid]: {
              ...dd,
              device: dd.device
                ? {
                    ...dd.device,
                    is_online: action.is_online,
                    last_seen_at: action.last_seen_at ?? dd.device.last_seen_at,
                  }
                : dd.device,
            },
          }
        : state.deviceDetails;

      return { ...state, devices, deviceDetails };
    }

    case "component_latest": {
      const d = state.deviceDetails[action.device_uid];
      if (!d) return state; // ignore if page not loaded
      return {
        ...state,
        deviceDetails: {
          ...state.deviceDetails,
          [action.device_uid]: {
            ...d,
            latest: {
              ...d.latest,
              [action.component_key]: {
                payload: action.payload,
                updated_at: action.updated_at,
              },
            },
          },
        },
      };
    }

    case "component_status": {
      const d = state.deviceDetails[action.device_uid];
      if (!d) return state;
      const components = d.components.map((c) =>
        c.component_key === action.component_key
          ? {
              ...c,
              is_online: action.is_online,
              last_seen_at: action.last_seen_at ?? c.last_seen_at,
            }
          : c
      );
      return {
        ...state,
        deviceDetails: {
          ...state.deviceDetails,
          [action.device_uid]: {
            ...d,
            components,
          },
        },
      };
    }

    default:
      return state;
  }
}

const Ctx = createContext<{
  state: State;
  loadDevices: () => Promise<void>;
  loadDevice: (deviceUid: string) => Promise<void>;
  createDevice: (input: { name?: string; description?: string }) => Promise<{
    device_uid: string;
    claim_token: string;
    claim_expires_at: string;
  }>;
  updateDevice: (
    deviceUid: string,
    input: { name?: string; description?: string }
  ) => Promise<Device>;
  deleteDevice: (deviceUid: string) => Promise<void>;
  ws: WsClient;
} | null>(null);

export function DeviceStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const ws = useMemo(
    () =>
      new WsClient(
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
          window.location.hostname
        }:4000/ws`
      ),
    []
  );

  useEffect(() => {
    const off = ws.on((msg: any) => {
      if (msg?.type === "component_latest") {
        dispatch({ type: "component_latest", ...msg });
        return;
      }
      if (msg?.type === "device_status") {
        dispatch({ type: "device_status", ...msg });
        return;
      }
      if (msg?.type === "component_status") {
        dispatch({ type: "component_status", ...msg });
      }
    });
    ws.connect();
    return () => {
      off();
      ws.close();
    };
  }, [ws]);

  async function loadDevices() {
    dispatch({ type: "devices_loading" });
    try {
      const devices = await listDevices();
      dispatch({ type: "devices_loaded", devices });
    } catch (e: any) {
      dispatch({ type: "devices_failed", error: e?.message ?? "Failed" });
    }
  }

  async function loadDevice(deviceUid: string) {
    dispatch({ type: "device_loading", deviceUid });
    try {
      const detail = await getDeviceDetail(deviceUid);
      dispatch({ type: "device_loaded", deviceUid, detail });
      ws.subscribe(deviceUid); // subscribe after initial load
    } catch (e: any) {
      dispatch({ type: "device_error", deviceUid, error: e?.message ?? "Failed" });
    }
  }

  async function createDevice(input: { name?: string; description?: string }) {
    const created = await apiCreateDevice(input);
    // refresh devices list
    await loadDevices();
    return created;
  }

  async function updateDevice(deviceUid: string, input: { name?: string; description?: string }) {
    const updated = await apiUpdateDevice(deviceUid, input);
    dispatch({ type: "device_updated", device: updated });
    return updated;
  }

  async function deleteDevice(deviceUid: string) {
    await apiDeleteDevice(deviceUid);
    dispatch({ type: "device_deleted", deviceUid });
  }

  return (
    <Ctx.Provider value={{ state, loadDevices, loadDevice, createDevice, updateDevice, deleteDevice, ws }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDeviceStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("DeviceStoreProvider missing");
  return v;
}
