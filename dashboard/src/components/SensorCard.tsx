import { useEffect, useState } from "react";
import type { Component } from "../api/devices";
import { JsonPreview } from "./JsonPreview";
import { updateComponentMeta } from "../api/devices";
import { Check, Code, EyeOff, Pencil, X, Clock } from "lucide-react";
import { ComponentVisual, VisualSelect } from "./ComponentVisual";

export function SensorCard({
  deviceUid,
  component,
  latest,
  onUpdated,
  isOnline = true,
}: {
  deviceUid: string;
  component: Component;
  latest?: { payload: any; updated_at: string };
  onUpdated: () => void;
  isOnline?: boolean;
}) {
  const currentName = component.meta?.name ?? component.component_key;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [visualBusy, setVisualBusy] = useState(false);
  const [visual, setVisual] = useState<string>(String(component.meta?.visual ?? "auto"));

  const payload = latest?.payload;
  const value = payload?.value;
  const unit = payload?.unit ?? component.capabilities?.unit;
  const componentOnline = (() => {
    if (!isOnline) return false;
    if (typeof component.is_online === "boolean") return component.is_online;
    if (!latest?.updated_at) return false;
    const ms = Date.now() - new Date(latest.updated_at).getTime();
    return ms < 20 * 1000;
  })();

  useEffect(() => {
    setVisual(String(component.meta?.visual ?? "auto"));
  }, [component.meta?.visual]);

  async function save() {
    setBusy(true);
    try {
      await updateComponentMeta(deviceUid, component.component_key, { name });
      setEditing(false);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function hide() {
    setBusy(true);
    try {
      await updateComponentMeta(deviceUid, component.component_key, { hidden: true });
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function changeVisual(next: string) {
    setVisual(next);
    setVisualBusy(true);
    try {
      await updateComponentMeta(deviceUid, component.component_key, { visual: next });
      onUpdated();
    } finally {
      setVisualBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {!editing ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                  {currentName}
                </div>
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                  {component.component_key}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-white/60">
                <Clock className="h-3.5 w-3.5" />
                {latest?.updated_at ? new Date(latest.updated_at).toLocaleString() : "No data yet"}
                {!componentOnline && (
                  <span className="rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[10px] text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100">
                    Offline
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-w-[180px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:focus:border-white/20"
              />
              <button
                disabled={busy}
                onClick={save}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
                title="Save"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                disabled={busy}
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
            {value != null ? `${value}` : "--"}
            {unit ? <span className="ml-1 text-sm text-gray-500 dark:text-white/60">{unit}</span> : null}
          </div>

          {!editing && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                title="Rename"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={hide}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                title="Hide"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 open:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:open:bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-white/50">
          <Code className="h-3.5 w-3.5" />
          Payload
        </summary>
        <div className="mt-2 text-[11px]">
          <JsonPreview data={payload ?? {}} />
        </div>
      </details>

      <ComponentVisual component={component} latest={latest} />

      <VisualSelect
        component={component}
        value={visual}
        onChange={changeVisual}
        disabled={visualBusy || busy}
      />
    </div>
  );
}
