import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDeviceStore } from "../store/deviceStore";
import { ComponentGrid } from "../components/ComponentGrid";
import { useToast } from "../components/ui/toast";
import {
  Activity,
  ArrowLeft,
  Copy,
  RefreshCcw,
  Cpu,
  Gauge,
  PlugZap,
  Eye,
  KeyRound,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { safeCopy } from "../utils/safeCopy";
import { regenerateClaimToken, updateComponentMeta } from "../api/devices";
import { DeviceDetailSkeleton } from "../components/ui/skeletons/DeviceDetailSkeleton";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString();
}

function statusPill(status?: string | null) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (status === "active") {
    return `${base} border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100`;
  }
  if (status === "unclaimed") {
    return `${base} border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100`;
  }
  if (status === "revoked") {
    return `${base} border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100`;
  }
  return `${base} border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70`;
}

function isOnlineDevice(device?: { is_online?: boolean; last_seen_at?: string | null }) {
  if (typeof device?.is_online === "boolean") return device.is_online;
  if (!device?.last_seen_at) return false;
  const ms = Date.now() - new Date(device.last_seen_at).getTime();
  return ms < 20 * 1000;
}

export function DeviceLivePage() {
  const { deviceUid = "" } = useParams();
  const { state, loadDevice } = useDeviceStore();
  const { push } = useToast();
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [claimExpiresAt, setClaimExpiresAt] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  useEffect(() => {
    if (!deviceUid) return;
    loadDevice(deviceUid).catch(console.error);
  }, [deviceUid]);

  const d = state.deviceDetails[deviceUid];
  const device = d?.device;

  useEffect(() => {
    if (device?.status !== "unclaimed") {
      setClaimToken(null);
      setClaimExpiresAt(null);
    }
  }, [device?.status]);

  const displayName = (device?.name ?? "").trim() || deviceUid;
  const description = device?.description?.trim();
  const status = device?.status ?? "unknown";
  const isLoading = !d || d.loading;
  const isInitialLoading = !d || (!d.device && d.loading);
  const isError = Boolean(d?.error);
  const isOnline = isOnlineDevice(device);

  const allComponents = d?.components ?? [];
  const visibleComponents = allComponents.filter((c) => !c.meta?.hidden);
  const sensors = visibleComponents.filter((c) => c.kind === "sensor").length;
  const actuators = visibleComponents.filter((c) => c.kind === "actuator").length;
  const hiddenCount = allComponents.length - visibleComponents.length;
  const hiddenComponents = allComponents.filter((c) => c.meta?.hidden);

  const lastTelemetryAt = useMemo(() => {
    const latest = d?.latest;
    if (!latest) return null;
    let newest: string | null = null;
    for (const item of Object.values(latest)) {
      const ts = item?.updated_at;
      if (!ts) continue;
      if (!newest || new Date(ts).getTime() > new Date(newest).getTime()) {
        newest = ts;
      }
    }
    return newest;
  }, [d?.latest]);

  async function onGenerateClaimToken() {
    if (!deviceUid) return;
    try {
      setClaimLoading(true);
      const res = await regenerateClaimToken(deviceUid);
      setClaimToken(res.claim_token);
      setClaimExpiresAt(res.claim_expires_at);
      const ok = await safeCopy(res.claim_token);
      push(ok ? "Claim token copied" : "Token ready — copy manually");
    } catch (e: any) {
      push(e?.message ?? "Failed to generate claim token");
    } finally {
      setClaimLoading(false);
    }
  }

  if (isInitialLoading) {
    return <DeviceDetailSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link
            to="/devices"
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to devices
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{displayName}</h1>
            <span className={statusPill(status)}>{status}</span>
            {isError && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                <Activity className="h-3 w-3" />
                Error
              </span>
            )}
          </div>

          {description && (
            <div className="text-sm text-gray-600 dark:text-white/70">
              {description}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-white/60">
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              {deviceUid}
            </span>
            <button
              onClick={() => {
                safeCopy(deviceUid).then((ok) =>
                  push(ok ? "Copied" : "Copy failed, select manually")
                );
              }}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            >
              <Copy className="h-3 w-3" />
              Copy UID
            </button>
            <span>Last seen: {formatDate(device?.last_seen_at)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadDevice(deviceUid).catch(console.error)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
            <span
              className={`h-2 w-2 rounded-full ${
                isError
                  ? "bg-red-400"
                  : isLoading
                  ? "bg-yellow-400"
                  : isOnline
                  ? "bg-emerald-400"
                  : "bg-gray-400"
              }`}
            />
            {isError
              ? "Connection issue"
              : isLoading
              ? "Syncing"
              : isOnline
              ? "Live updates"
              : "Offline"}
          </div>
        </div>
      </div>

      {status === "unclaimed" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <KeyRound className="h-4 w-4" />
              Device is unclaimed
            </div>
            <button
              onClick={onGenerateClaimToken}
              disabled={claimLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900 hover:bg-amber-200 disabled:opacity-60 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30"
            >
              {claimLoading ? "Generating..." : "Generate claim token"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-amber-900/90 dark:text-amber-100/90">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5" />
              <span>Use the claim token once to authenticate the device.</span>
            </div>
            <div className="flex items-start gap-2">
              <Radio className="mt-0.5 h-3.5 w-3.5" />
              <span>
                Device calls <span className="font-mono">POST /api/devices/claim</span> with{" "}
                <span className="font-mono">device_uid</span> +{" "}
                <span className="font-mono">claim_token</span>.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Activity className="mt-0.5 h-3.5 w-3.5" />
              <span>Tokens expire; generate a new one if needed.</span>
            </div>
          </div>

          {claimToken && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-black/20 dark:text-amber-100">
              <div className="text-[11px] uppercase tracking-wide text-amber-700/80 dark:text-amber-200/80">
                Claim token (show once)
              </div>
              <div className="mt-1 break-all font-mono">{claimToken}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
                    const ok = await safeCopy(claimToken);
                    push(ok ? "Copied" : "Copy failed, select manually");
                  }}
                  className="rounded-lg border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] text-amber-900 hover:bg-amber-200 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30"
                >
                  Copy token
                </button>
                {claimExpiresAt && (
                  <span className="text-[11px] text-amber-800/80 dark:text-amber-100/70">
                    Expires {new Date(claimExpiresAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !isOnline && status !== "unclaimed" && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100">
          Device is offline. Showing last known telemetry; controls are disabled.
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {d?.error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/60">
            <span>Components</span>
            <Cpu className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {visibleComponents.length}
          </div>
          {hiddenCount > 0 && (
            <div className="mt-1 text-xs text-gray-500 dark:text-white/50">
              {hiddenCount} hidden
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/60">
            <span>Sensors</span>
            <Gauge className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {sensors}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/60">
            <span>Actuators</span>
            <PlugZap className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {actuators}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/60">
            <span>Last telemetry</span>
            <Activity className="h-4 w-4" />
          </div>
          <div className="mt-2 text-sm text-gray-900 dark:text-white">
            {formatDate(lastTelemetryAt)}
          </div>
        </div>
      </div>

      {visibleComponents.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
          No visible components yet. When the device sends telemetry, components will appear here.
        </div>
      ) : (
        <ComponentGrid
          deviceUid={deviceUid}
          components={visibleComponents}
          latest={d?.latest ?? {}}
          onRefresh={() => loadDevice(deviceUid).catch(console.error)}
          isOnline={isOnline}
        />
      )}

      {!isLoading && hiddenComponents.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Hidden components
            </div>
            <div className="text-xs text-gray-500 dark:text-white/60">
              {hiddenComponents.length} hidden
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {hiddenComponents.map((c) => {
              const label = c.meta?.name ?? c.component_key;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-900 dark:text-white/90">
                      {label}
                    </div>
                    <div className="truncate font-mono text-[10px] text-gray-500 dark:text-white/50">
                      {c.component_key}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await updateComponentMeta(deviceUid, c.component_key, { hidden: false });
                        push("Component restored");
                        await loadDevice(deviceUid);
                      } catch (e: any) {
                        push(e?.message ?? "Failed to restore component");
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Unhide
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
