import { useEffect, useState } from "react";
import type { Component } from "../api/devices";
import { sendCommand, updateComponentMeta } from "../api/devices";
import { JsonPreview } from "./JsonPreview";
import { Check, Code, EyeOff, Pencil, Send, X, Zap, Clock } from "lucide-react";
import { ComponentVisual, VisualSelect } from "./ComponentVisual";

export function ActuatorCard({
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
  const rawCommands = component.capabilities?.commands;
  const commands: string[] = Array.isArray(rawCommands) ? rawCommands : [];
  const displayCommands = commands.length > 0 ? commands : ["on", "off"];

  const [busy, setBusy] = useState<string | null>(null);
  const [customJson, setCustomJson] = useState<string>('{"state":"on"}');
  const [err, setErr] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const canControl = isOnline;
  const offlineMessage = "Device is offline. Commands are disabled.";
  const [visualBusy, setVisualBusy] = useState(false);
  const [visual, setVisual] = useState<string>(String(component.meta?.visual ?? "auto"));

  useEffect(() => {
    setVisual(String(component.meta?.visual ?? "auto"));
  }, [component.meta?.visual]);

  async function saveName() {
    setErr(null);
    setBusy("rename");
    try {
      await updateComponentMeta(deviceUid, component.component_key, { name });
      setEditing(false);
      onUpdated();
    } catch (e: any) {
      setErr(e?.message ?? "Rename failed");
    } finally {
      setBusy(null);
    }
  }

  async function hide() {
    setErr(null);
    setBusy("hide");
    try {
      await updateComponentMeta(deviceUid, component.component_key, { hidden: true });
      onUpdated();
    } catch (e: any) {
      setErr(e?.message ?? "Hide failed");
    } finally {
      setBusy(null);
    }
  }

  async function runCommand(cmd: any, label: string) {
    setErr(null);
    setBusy(label);
    try {
      await sendCommand({
        deviceUid,
        component_key: component.component_key,
        command: cmd,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Command failed");
    } finally {
      setBusy(null);
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
                {latest?.updated_at ? new Date(latest.updated_at).toLocaleString() : "No state yet"}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  disabled={busy != null}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  title="Rename"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={hide}
                  disabled={busy != null}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  title="Hide"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
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
                onClick={saveName}
                disabled={busy != null}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                onClick={() => {
                  setName(currentName);
                  setEditing(false);
                }}
                disabled={busy != null}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {displayCommands.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {displayCommands.map((c) => (
            <button
              key={c}
              onClick={() => runCommand({ state: c }, c)}
              disabled={busy != null || !canControl}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            >
              <Zap className="h-3.5 w-3.5" />
              {busy === c ? "Sending..." : c}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-500 dark:text-white/60">
          No commands found. Use the custom JSON sender.
        </div>
      )}

      {canControl ? (
        <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 open:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:open:bg-white/[0.03]">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-white/50">
            <Send className="h-3.5 w-3.5" />
            Custom command
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-[11px] text-gray-800 outline-none focus:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:focus:border-white/20"
            />
            <button
              onClick={() => {
                try {
                  const obj = JSON.parse(customJson);
                  runCommand(obj, "custom");
                } catch {
                  setErr("Invalid JSON");
                }
              }}
              disabled={busy != null}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            >
              <Send className="h-3.5 w-3.5" />
              {busy === "custom" ? "Sending..." : "Send"}
            </button>
          </div>
        </details>
      ) : (
        <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100">
          {offlineMessage}
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {err}
        </div>
      )}

      <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 open:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:open:bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-white/50">
          <Code className="h-3.5 w-3.5" />
          Latest payload
        </summary>
        <div className="mt-2 text-[11px]">
          <JsonPreview data={latest?.payload ?? {}} />
        </div>
      </details>

      <ComponentVisual component={component} latest={latest} />

      <VisualSelect
        component={component}
        value={visual}
        onChange={changeVisual}
        disabled={visualBusy || busy != null}
      />
    </div>
  );
}
