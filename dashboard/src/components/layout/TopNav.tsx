import { Bell, Search, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { useDeviceStore } from "../../store/deviceStore";
import { useLocation, useNavigate } from "react-router-dom";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/notifications";
import type { Notification } from "../../api/notifications";
import { useToast } from "../ui/toast";



const NOTIF_PAGE_SIZE = 15;

export function TopNav() {
  const { state, loadDevices, ws } = useDeviceStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const requestedRef = useRef(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifLoadingMore, setNotifLoadingMore] = useState(false);
  const [notifHasMore, setNotifHasMore] = useState(true);
  const [notifCursor, setNotifCursor] = useState<number | null>(null);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const current = params.get("q") ?? "";
    if (location.pathname === "/devices") {
      setQuery(current);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!query.trim()) return;
    if (state.devices.length > 0 || state.devicesLoading) return;
    if (requestedRef.current) return;
    requestedRef.current = true;
    loadDevices().catch(console.error);
  }, [query, state.devices.length, state.devicesLoading]);

  useEffect(() => {
    if (!notifOpen) return;
    setNotifLoading(true);
    setNotifLoadingMore(false);
    setNotifHasMore(true);
    setNotifCursor(null);
    listNotifications({ limit: NOTIF_PAGE_SIZE, filter: notifFilter })
      .then((rows) => {
        setNotifications(rows);
        setNotifCursor(rows.length > 0 ? rows[rows.length - 1].id : null);
        setNotifHasMore(rows.length === NOTIF_PAGE_SIZE);
      })
      .catch(console.error)
      .finally(() => setNotifLoading(false));
  }, [notifOpen, notifFilter]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!notifOpen) return;
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notifOpen]);

  useEffect(() => {
    const off = ws.on((msg: any) => {
      if (msg?.type !== "notification") return;
      const n = msg.notification as Notification;
      setNotifications((prev) => {
        if (notifFilter === "unread" && n.read_at) return prev;
        if (prev.some((item) => item.id === n.id)) return prev;
        return [n, ...prev];
      });
      push(`${n.title}: ${n.body}`);
    });
    return () => {
      off();
    };
  }, [ws, push, notifFilter]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.devices
      .filter((d) => {
        const hay = `${d.device_uid} ${d.name ?? ""} ${d.description ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 6);
  }, [query, state.devices]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  async function loadMoreNotifications() {
    if (notifLoading || notifLoadingMore || !notifHasMore) return;
    setNotifLoadingMore(true);
    try {
      const rows = await listNotifications({
        limit: NOTIF_PAGE_SIZE,
        beforeId: notifCursor ?? undefined,
        filter: notifFilter,
      });
      setNotifications((prev) => {
        if (rows.length === 0) return prev;
        const map = new Map(prev.map((item) => [item.id, item]));
        for (const row of rows) map.set(row.id, row);
        return Array.from(map.values()).sort((a, b) => b.id - a.id);
      });
      setNotifCursor(rows.length > 0 ? rows[rows.length - 1].id : notifCursor);
      setNotifHasMore(rows.length === NOTIF_PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setNotifLoadingMore(false);
    }
  }

  function onNotifScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 40) {
      loadMoreNotifications();
    }
  }

  function updateQuery(next: string) {
    setQuery(next);
    setOpen(true);
    if (location.pathname === "/devices") {
      const params = new URLSearchParams(location.search);
      if (next.trim()) params.set("q", next);
      else params.delete("q");
      navigate(
        {
          pathname: "/devices",
          search: params.toString() ? `?${params.toString()}` : "",
        },
        { replace: true }
      );
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#0b0f14]/80">

      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
            ⚡
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">IoT Dashboard</div>
            <div className="text-[11px] text-gray-500 dark:text-white/60">Production</div>
          </div>
        </div>

        <div className="relative hidden w-[520px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 md:flex dark:border-white/10 dark:bg-white/5">
          <Search className="h-4 w-4 text-gray-500 dark:text-white/60" />
          <input
            className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/40"
            placeholder="Search devices, components…"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && query.trim()) {
                navigate(`/devices?q=${encodeURIComponent(query.trim())}`);
                setOpen(false);
              }
            }}
          />
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            ⌘K
          </div>

          {open && query.trim() && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0b0f14]">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/50">
                Suggestions
              </div>
              <div className="max-h-72 overflow-y-auto">
                {suggestions.map((d) => (
                  <button
                    key={d.device_uid}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(`/devices/${encodeURIComponent(d.device_uid)}`);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/10"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900 dark:text-white/90">
                        {d.name?.trim() ? d.name : "Unnamed device"}
                      </div>
                      <div className="truncate text-[11px] text-gray-500 dark:text-white/60">
                        {d.device_uid}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-white/60">
                      {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never seen"}
                    </div>
                  </button>
                ))}

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate(`/devices?q=${encodeURIComponent(query.trim())}`);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white/90">
                    Search devices for “{query.trim()}”
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-white/60">
                    View list
                  </div>
                </button>

                {suggestions.length === 0 && (
                  <div className="px-3 py-3 text-sm text-gray-500 dark:text-white/60">
                    No matches yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="cursor-pointer"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="h-4 w-4 text-gray-700 dark:text-white/80" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>

            {notifOpen && (
              <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0b0f14]">
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-white/10">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    Notifications
                  </div>
                  <button
                    onClick={async () => {
                      await markAllNotificationsRead().catch(console.error);
                      const now = new Date().toISOString();
                      setNotifications((prev) => {
                        if (notifFilter === "unread") return [];
                        return prev.map((n) => ({ ...n, read_at: n.read_at ?? now }));
                      });
                      if (notifFilter === "unread") {
                        setNotifHasMore(false);
                      }
                    }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white/80"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-white/10">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-white/50">
                    Filter
                  </div>
                  <button
                    onClick={() => setNotifFilter("all")}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                      notifFilter === "all"
                        ? "border-gray-300 bg-gray-900 text-white dark:border-white/10 dark:bg-white dark:text-gray-900"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setNotifFilter("unread")}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                      notifFilter === "unread"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                    }`}
                  >
                    Unread
                  </button>
                  <div className="ml-auto text-[11px] text-gray-500 dark:text-white/50">
                    Recent {NOTIF_PAGE_SIZE}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto" onScroll={onNotifScroll}>
                  {notifLoading && (
                    <div className="px-3 py-3 text-sm text-gray-500 dark:text-white/60">
                      Loading...
                    </div>
                  )}

                  {!notifLoading && notifications.length === 0 && (
                    <div className="px-3 py-6 text-sm text-gray-500 dark:text-white/60">
                      No notifications yet.
                    </div>
                  )}

                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={async () => {
                        if (!n.read_at) {
                          const updated = await markNotificationRead(n.id).catch(() => null);
                          if (updated) {
                            setNotifications((prev) => {
                              if (notifFilter === "unread" && updated.read_at) {
                                return prev.filter((item) => item.id !== n.id);
                              }
                              return prev.map((item) => (item.id === n.id ? updated : item));
                            });
                          }
                        }
                      }}
                      className="flex w-full items-start gap-3 border-b border-gray-100 px-3 py-3 text-left hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/10"
                    >
                      <span
                        className={`mt-1 h-2 w-2 rounded-full ${
                          n.read_at ? "bg-gray-300 dark:bg-white/20" : "bg-emerald-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
                          {n.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-white/70">
                          {n.body}
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500 dark:text-white/50">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  ))}

                  {notifLoadingMore && (
                    <div className="px-3 py-3 text-xs text-gray-500 dark:text-white/60">
                      Loading more...
                    </div>
                  )}

                  {!notifLoading && !notifLoadingMore && notifications.length > 0 && !notifHasMore && (
                    <div className="px-3 py-3 text-xs text-gray-500 dark:text-white/60">
                      You're all caught up.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" aria-label="Settings" className="cursor-pointer">
            <Settings className="h-4 w-4 text-gray-700 dark:text-white/80" />
          </Button>
          <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
