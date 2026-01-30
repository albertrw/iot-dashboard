import { useEffect, useState } from "react";
import { useDeviceStore } from "../store/deviceStore";
import DeviceCard from "../components/devices/DeviceCard";
import DeviceCardSkeleton from "../components/devices/DeviceCardSkeleton";
import EmptyDevicesState from "../components/devices/EmptyDevicesState";

import { Plus } from "lucide-react";

export default function DevicesPage() {
  const { state, loadDevices, createDevice } = useDeviceStore();
  const [search, setSearch] = useState("");
  const { devices, devicesLoading } = state;

  useEffect(() => {
    loadDevices().catch(console.error);
  }, [loadDevices]);

  const filtered = devices.filter((d) =>
    (d.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Devices</h1>
        <button
          onClick={() => createDevice({})}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:opacity-90"
        >
          <Plus size={18} />
          Add Device
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search devices..."
        className="w-full rounded-lg border bg-background px-4 py-2"
      />

      {/* Content */}
      {devicesLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <DeviceCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!devicesLoading && filtered.length === 0 && (
        <EmptyDevicesState />
      )}

      {!devicesLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(device => (
            <DeviceCard key={device.device_uid} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
