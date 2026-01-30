import { Link } from "react-router-dom";
import { Power, Wifi, WifiOff } from "lucide-react";
import InlineEditableText from "./InlineEditableText";
import { useDeviceStore } from "../../store/deviceStore";

function isOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const ms = Date.now() - new Date(lastSeenAt).getTime();
  return ms < 20 * 1000;
}

export default function DeviceCard({ device }: any) {
  const { updateDevice } = useDeviceStore();
  const online = typeof device.is_online === "boolean" ? device.is_online : isOnline(device.last_seen_at);

  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <InlineEditableText
          value={device.name}
          onSave={(name) => updateDevice(device.device_uid, { name })}
        />

        <div className={`flex items-center gap-1 text-sm ${online ? "text-green-500" : "text-muted-foreground"}`}>
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {online ? "Online" : "Offline"}
        </div>
      </div>

      {device.description && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {device.description}
        </p>
      )}

      <div className="mt-4 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          UID: {device.device_uid.slice(0, 8)}…
        </span>

        <Link
          to={`/devices/${device.device_uid}`}
          className="text-sm text-primary hover:underline"
        >
          Open →
        </Link>
      </div>
    </div>
  );
}
