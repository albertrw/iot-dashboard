import type { Component } from "../api/devices";

type VisualKind =
  | "auto"
  | "thermometer"
  | "motion"
  | "water"
  | "distance"
  | "gauge"
  | "bulb"
  | "switch";

type LatestPayload = { payload: any; updated_at: string } | undefined;

const SENSOR_VISUALS: { value: VisualKind; label: string }[] = [
  { value: "thermometer", label: "Thermometer" },
  { value: "motion", label: "Motion" },
  { value: "water", label: "Water level" },
  { value: "distance", label: "Distance bar" },
  { value: "gauge", label: "Gauge" },
];

const ACTUATOR_VISUALS: { value: VisualKind; label: string }[] = [
  { value: "bulb", label: "Bulb" },
  { value: "switch", label: "Switch" },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getRange(component: Component, latest: LatestPayload) {
  const unit = String(latest?.payload?.unit ?? component.capabilities?.unit ?? "").toLowerCase();
  const min = Number(component.capabilities?.min ?? 0);
  const maxFromCaps = component.capabilities?.max;
  const max = Number(
    maxFromCaps ??
      (unit === "cm" || unit === "mm" ? 200 : unit === "c" || unit === "f" ? 100 : 100)
  );
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { min: 0, max: 100 };
  }
  return { min, max };
}

function inferSensorVisual(component: Component, latest: LatestPayload): VisualKind {
  const name = `${component.component_key} ${component.meta?.name ?? ""}`.toLowerCase();
  const unit = String(latest?.payload?.unit ?? component.capabilities?.unit ?? "").toLowerCase();
  const states = Array.isArray(component.capabilities?.states)
    ? component.capabilities?.states.map((s: any) => String(s).toLowerCase())
    : [];
  if (name.includes("pir") || name.includes("motion") || states.includes("motion")) {
    return "motion";
  }
  if (name.includes("water") || unit.includes("level") || states.includes("wet")) return "water";
  if (name.includes("distance") || unit === "cm" || unit === "mm" || unit === "m") {
    return "distance";
  }
  if (name.includes("temp") || unit === "c" || unit === "f" || unit.includes("°")) {
    return "thermometer";
  }
  return "gauge";
}

function resolveVisual(component: Component, latest: LatestPayload): VisualKind {
  const chosen = String(component.meta?.visual ?? "auto") as VisualKind;
  if (chosen && chosen !== "auto") return chosen;
  if (component.kind === "actuator") return "bulb";
  return inferSensorVisual(component, latest);
}

function isOn(payload: any) {
  if (!payload) return false;
  const state = payload.state ?? payload.value;
  if (typeof state === "string") return state.toLowerCase() === "on";
  if (typeof state === "boolean") return state;
  return false;
}

function waterLevelFromPayload(payload: any) {
  const value = String(payload?.value ?? "").toLowerCase();
  if (["dry", "low", "medium", "high"].includes(value)) return value;
  const raw = parseNumber(payload?.raw);
  if (raw == null) return "dry";
  const pct = clamp(raw / 1023);
  if (pct < 0.25) return "dry";
  if (pct < 0.5) return "low";
  if (pct < 0.8) return "medium";
  return "high";
}

function VisualThermometer({ percent }: { percent: number }) {
  const fill = Math.max(6, Math.round(percent * 100));
  return (
    <div className="flex items-end gap-3">
      <div className="relative h-24 w-10">
        <div className="absolute left-1/2 top-0 h-20 w-4 -translate-x-1/2 rounded-full border border-gray-200 bg-white/70 shadow-inner dark:border-white/10 dark:bg-white/[0.05]" />
        <div
          className="absolute bottom-5 left-1/2 w-3 -translate-x-1/2 rounded-full bg-gradient-to-t from-rose-600 via-rose-400 to-orange-300 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
          style={{ height: `${fill}%` }}
        />
        <div className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border border-rose-200 bg-rose-500/80 shadow-[0_0_18px_rgba(244,63,94,0.45)] dark:border-rose-500/30" />
        <div className="absolute right-0 top-2 flex h-16 flex-col justify-between">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`tick-${i}`}
              className="h-[2px] w-3 rounded-full bg-gray-300/80 dark:bg-white/20"
            />
          ))}
        </div>
      </div>
      <div className="text-[11px] font-semibold text-gray-500 dark:text-white/60">
        {Math.round(percent * 100)}%
      </div>
    </div>
  );
}

function VisualMotion({ motion }: { motion: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
          motion
            ? "border-emerald-300 bg-emerald-400/20 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
            : "border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/5"
        }`}
      >
        <div
          className={`h-3 w-3 rounded-full ${
            motion ? "bg-emerald-400" : "bg-gray-400 dark:bg-white/30"
          }`}
        />
      </div>
      <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-white/60">
        {motion ? "Motion" : "Idle"}
      </div>
    </div>
  );
}

function VisualWater({ level }: { level: string }) {
  const map: Record<string, number> = { dry: 0.1, low: 0.35, medium: 0.6, high: 0.9 };
  const percent = map[level] ?? 0.1;
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]">
      <div
        className="absolute bottom-0 left-0 right-0 bg-sky-500/40"
        style={{ height: `${Math.round(percent * 100)}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase text-gray-600 dark:text-white/70">
        {level}
      </div>
    </div>
  );
}

function VisualDistance({ percent }: { percent: number }) {
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]">
        <div
          className="h-full bg-emerald-500/70"
          style={{ width: `${Math.round(percent * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-500 dark:text-white/50">
        <span>Far</span>
        <span>Near</span>
      </div>
    </div>
  );
}

function VisualGauge({ percent }: { percent: number }) {
  const pct = Math.round(percent * 100);
  return (
    <div
      className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80"
      style={{
        background: `conic-gradient(rgba(16,185,129,0.7) ${pct * 3.6}deg, rgba(148,163,184,0.2) 0deg)`,
      }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-700 dark:bg-[#0b0f14] dark:text-white/80">
        {pct}%
      </div>
    </div>
  );
}

function VisualBulb({ on }: { on: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-10 w-10 rounded-full border ${
          on
            ? "border-amber-300 bg-amber-300/80 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
            : "border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/5"
        }`}
      />
      <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-white/60">
        {on ? "On" : "Off"}
      </div>
    </div>
  );
}

function VisualSwitch({ on }: { on: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative h-6 w-12 rounded-full border ${
          on
            ? "border-emerald-400/60 bg-emerald-400/60"
            : "border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/5"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-6" : "left-0.5"
          }`}
        />
      </div>
      <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-white/60">
        {on ? "On" : "Off"}
      </div>
    </div>
  );
}

export function ComponentVisual({
  component,
  latest,
}: {
  component: Component;
  latest?: { payload: any; updated_at: string };
}) {
  const visual = resolveVisual(component, latest);
  const payload = latest?.payload ?? {};
  const numeric = parseNumber(payload.value);
  const range = getRange(component, latest);
  const percent = numeric == null ? 0 : clamp((numeric - range.min) / (range.max - range.min));
  const distancePercent = numeric == null ? 0 : clamp(1 - numeric / range.max);
  const motion = String(payload.value ?? "").toLowerCase() === "motion";

  if (component.kind === "actuator") {
    const on = isOn(payload);
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
        {visual === "switch" ? <VisualSwitch on={on} /> : <VisualBulb on={on} />}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      {visual === "thermometer" && <VisualThermometer percent={percent} />}
      {visual === "motion" && <VisualMotion motion={motion} />}
      {visual === "water" && <VisualWater level={waterLevelFromPayload(payload)} />}
      {visual === "distance" && <VisualDistance percent={distancePercent} />}
      {visual === "gauge" && <VisualGauge percent={percent} />}
    </div>
  );
}

export function VisualSelect({
  component,
  value,
  onChange,
  disabled,
}: {
  component: Component;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const options = component.kind === "actuator" ? ACTUATOR_VISUALS : SENSOR_VISUALS;
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-white/60">
      <span className="text-[11px] uppercase tracking-wide">Visual</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-300 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:focus:border-white/20"
      >
        <optgroup label="Recommended">
          <option value="auto">Auto</option>
        </optgroup>
        <optgroup label={component.kind === "actuator" ? "Actuators" : "Sensors"}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
