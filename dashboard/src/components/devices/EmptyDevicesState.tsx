import { Cpu } from "lucide-react";

export default function EmptyDevicesState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
      <Cpu size={48} className="text-muted-foreground" />
      <h2 className="text-lg font-medium">No devices yet</h2>
      <p className="text-muted-foreground max-w-sm">
        Create your first device to start streaming telemetry and controlling hardware remotely.
      </p>
    </div>
  );
}
