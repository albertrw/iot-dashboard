import type { Component } from "../api/devices";
import { SensorCard } from "./SensorCard";
import { ActuatorCard } from "./ActuatorCard";

export function ComponentGrid({
  deviceUid,
  components,
  latest,
  onRefresh,
  isOnline,
}: {
  deviceUid: string;
  components: Component[];
  latest: Record<string, { payload: any; updated_at: string }>;
  onRefresh: () => void;
  isOnline?: boolean;
}) {
  const sorted = [...components].sort((a, b) => a.component_key.localeCompare(b.component_key));
  const visible = sorted.filter((c) => !c.meta?.hidden);

  return (
    <div style={gridStyle}>
      {visible.map((c) => {
        const l = latest[c.component_key];

        if (c.kind === "sensor")
          return (
            <SensorCard
              key={c.id}
              deviceUid={deviceUid}
              component={c}
              latest={l}
              onUpdated={onRefresh}
              isOnline={isOnline}
            />
          );

        if (c.kind === "actuator")
          return (
            <ActuatorCard
              key={c.id}
              deviceUid={deviceUid}
              component={c}
              latest={l}
              onUpdated={onRefresh}
              isOnline={isOnline}
            />
          );

        return null;
      })}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};
