import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDeviceStore } from "../store/deviceStore";
import { Cpu, Activity, CheckCircle2 } from "lucide-react";
import { DashboardOverviewSkeleton } from "../components/ui/skeletons/DashboardOverviewSkeleton";

function StatCard({
  title,
  value,
  subtitle,
  icon,
  to,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 no-underline transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-700 dark:text-white/80">{title}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">
            {value}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-white/60">{subtitle}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-gray-700 group-hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:group-hover:bg-white/10">
          {icon}
        </div>
      </div>
    </Link>
  );
}

export function DashboardOverviewPage() {
  const { state, loadDevices } = useDeviceStore();

  useEffect(() => {
    loadDevices().catch(console.error);
  }, []);

  const stats = useMemo(() => {
    const devices = state.devices;

    const total = devices.length;
    const active = devices.filter((d) => d.status === "active").length;
    const online = devices.filter((d) => {
      if (typeof d.is_online === "boolean") return d.is_online;
      if (!d.last_seen_at) return false;
      const ms = Date.now() - new Date(d.last_seen_at).getTime();
      return ms < 20 * 1000;
    }).length;

    return { total, active, online };
  }, [state.devices]);

  if (state.devicesLoading) {
    return <DashboardOverviewSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 dark:text-white/60">Dashboard</div>
          <h1 className="text-xl font-semibold">Overview</h1>
        </div>

        <Link
          to="/devices"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 no-underline transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
        >
          View devices →
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          title="Total devices"
          value={stats.total}
          subtitle="All devices registered under your account"
          to="/devices"
          icon={<Cpu className="h-5 w-5" />}
        />
        <StatCard
          title="Active"
          value={stats.active}
          subtitle="Devices currently marked active"
          to="/devices?filter=active"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Online now"
          value={stats.online}
          subtitle="Last seen in the past 2 minutes"
          to="/devices?filter=online"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Recent devices preview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900 dark:text-white/80">
            Recent devices
          </div>
          <Link
            to="/devices"
            className="text-sm text-gray-500 no-underline hover:text-gray-700 dark:text-white/60 dark:hover:text-white/80"
          >
            Manage →
          </Link>
        </div>

        <div className="mt-3 grid gap-2">
          {state.devices.slice(0, 5).map((d) => (
            <Link
              key={d.device_uid}
              to={`/devices/${encodeURIComponent(d.device_uid)}`}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 no-underline transition-colors hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {d.name?.trim() ? d.name : d.device_uid}
                  </div>
                  <div className="truncate text-xs text-gray-500 dark:text-white/60">
                    {d.name?.trim() ? d.device_uid : d.description ?? ""}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-white/60">
                  {d.last_seen_at
                    ? new Date(d.last_seen_at).toLocaleString()
                    : "—"}
                </div>
              </div>
            </Link>
          ))}

          {state.devices.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-white/60">No devices yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
