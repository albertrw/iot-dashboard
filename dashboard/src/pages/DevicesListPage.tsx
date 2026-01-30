import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Copy, Trash2, Pencil, LayoutGrid, List } from "lucide-react";
import { useDeviceStore } from "../store/deviceStore";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/toast";
import { safeCopy } from "../utils/safeCopy";
import { DevicesListSkeleton } from "../components/ui/skeletons/DevicesListSkeleton";

function pillColor(status?: string | null) {
  if (status === "active") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
  }
  if (status === "unclaimed") {
    return "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100";
  }
  return "border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70";
}

function isOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const ms = Date.now() - new Date(lastSeenAt).getTime();
  return ms < 20 * 1000;
}

export function DevicesListPage() {
  const { state, loadDevices, createDevice, updateDevice, deleteDevice } = useDeviceStore();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  const queryParam = searchParams.get("q") ?? "";
  const filterLabel =
    filter === "active"
      ? "Active"
      : filter === "online"
      ? "Online"
      : filter === "unclaimed"
      ? "Unclaimed"
      : null;
  const currentFilter =
    filter === "active" || filter === "online" || filter === "unclaimed" ? filter : "all";

  const [q, setQ] = useState(queryParam);
  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    const saved = localStorage.getItem("devices_view_mode");
    return saved === "list" ? "list" : "cards";
  });

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdExpires, setCreatedExpires] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);

  useEffect(() => {
    loadDevices().catch(console.error);
  }, []);

  useEffect(() => {
    setQ(queryParam);
  }, [queryParam]);

  useEffect(() => {
    localStorage.setItem("devices_view_mode", viewMode);
  }, [viewMode]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let items = state.devices;

    if (filter === "active") {
      items = items.filter((d) => d.status === "active");
    } else if (filter === "online") {
      items = items.filter((d) => (d.is_online ?? isOnline(d.last_seen_at)));
    } else if (filter === "unclaimed") {
      items = items.filter((d) => d.status === "unclaimed");
    }

    if (!query) return items;
    return items.filter((d) => {
      const hay = `${d.device_uid} ${d.name ?? ""} ${d.description ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [q, state.devices, filter]);

  async function copy(text: string) {
    const ok = await safeCopy(text);
    push(ok ? "Copied" : "Copy failed, select manually");
    return ok;
  }

  async function onCreate() {
    try {
      const created = await createDevice({ name: addName, description: addDesc });
      setAddName("");
      setAddDesc("");
      setCreatedToken(created.claim_token);
      setCreatedExpires(created.claim_expires_at);

      await copy(created.claim_token);
    } catch (e: any) {
      push(e?.message ?? "Failed to create device");
    }
  }

  function setFilter(next: "all" | "active" | "online" | "unclaimed") {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    setSearchParams(params);
  }

  function openAdd() {
    setAddOpen(true);
    setCreatedToken(null);
    setCreatedExpires(null);
  }

  function closeAdd() {
    setAddOpen(false);
    setCreatedToken(null);
    setCreatedExpires(null);
  }

  function openEdit(uid: string, name?: string | null, desc?: string | null) {
    setEditUid(uid);
    setEditName(name ?? "");
    setEditDesc(desc ?? "");
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!editUid) return;
    try {
      await updateDevice(editUid, { name: editName, description: editDesc });
      setEditOpen(false);
      push("Device updated");
    } catch (e: any) {
      push(e?.message ?? "Failed to update device");
    }
  }

  async function onDelete(uid: string) {
    try {
      await deleteDevice(uid);
      push("Device deleted");
    } catch (e: any) {
      push(e?.message ?? "Failed to delete device");
    }
  }

  function openDelete(uid: string, name?: string | null) {
    setDeleteUid(uid);
    setDeleteName(name ?? null);
    setDeleteOpen(true);
  }

  function closeDelete() {
    setDeleteOpen(false);
    setDeleteUid(null);
    setDeleteName(null);
  }

  return (
    <div className="space-y-4">
      {state.devicesLoading ? (
        <DevicesListSkeleton />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to="/"
                className="inline-flex items-center pt-2 pb-2 text-xs text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white"
              >
                ← Back to dashboard
              </Link>
              <div className="text-xs text-gray-500 dark:text-white/60">Workspace</div>
              <h1 className="text-xl font-semibold">Devices</h1>
              {filterLabel && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-white/60">
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    Filter: {filterLabel}
                  </span>
                  <Link
                    to="/devices"
                    className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white"
                  >
                    Clear
                  </Link>
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    currentFilter === "all"
                      ? "border-gray-300 bg-gray-900 text-white dark:border-white/10 dark:bg-white dark:text-gray-900"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("active")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    currentFilter === "active"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilter("online")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    currentFilter === "online"
                      ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-100"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setFilter("unclaimed")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    currentFilter === "unclaimed"
                      ? "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-100"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  Unclaimed
                </button>
              </div>

              <button
                onClick={openAdd}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
              >
                <Plus className="h-4 w-4" />
                Add device
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-white/60">View</div>
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">
              <button
                onClick={() => setViewMode("cards")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs ${
                  viewMode === "cards"
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/10"
                }`}
                title="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs ${
                  viewMode === "list"
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/10"
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
          </div>

          {/* Content */}
          {viewMode === "cards" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => {
                const title = d.name?.trim() ? d.name : "Unnamed device";
                const online = d.is_online ?? isOnline(d.last_seen_at);

                return (
                  <div
                    key={d.device_uid}
                    className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                          {title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-white/60">
                          <span className="truncate">{d.device_uid}</span>
                          <button
                            onClick={() => copy(d.device_uid)}
                            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/5"
                            title="Copy UID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {d.description && (
                          <div className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-white/70">
                            {d.description}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(d.device_uid, d.name, d.description)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/5"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(d.device_uid, d.name)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/5"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <div className={`rounded-full border px-2 py-1 ${pillColor(d.status)}`}>
                        {d.status ?? "unknown"}
                      </div>

                      <div className="flex items-center gap-2 text-gray-500 dark:text-white/60">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            online ? "bg-emerald-400" : "bg-gray-300 dark:bg-white/20"
                          }`}
                          title={online ? "Online" : "Offline"}
                        />
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never seen"}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        to={`/devices/${encodeURIComponent(d.device_uid)}`}
                        className="inline-flex rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 no-underline dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                      >
                        Open →
                      </Link>

                      <button
                        onClick={() => copy(`${window.location.origin}/devices/${d.device_uid}`)}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
                  No devices match your search.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => {
                const title = d.name?.trim() ? d.name : "Unnamed device";
                const online = d.is_online ?? isOnline(d.last_seen_at);

                return (
                  <div
                    key={d.device_uid}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/devices/${encodeURIComponent(d.device_uid)}`}
                            className="truncate text-sm font-semibold text-gray-900 no-underline hover:text-gray-700 dark:text-white/90 dark:hover:text-white"
                          >
                            {title}
                          </Link>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${pillColor(
                              d.status
                            )}`}
                          >
                            {d.status ?? "unknown"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-white/60">
                          <span className="font-mono text-[11px]">{d.device_uid}</span>
                          <button
                            onClick={() => copy(d.device_uid)}
                            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/5"
                            title="Copy UID"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                online ? "bg-emerald-400" : "bg-gray-300 dark:bg-white/20"
                              }`}
                            />
                            {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never seen"}
                          </span>
                        </div>
                        {d.description && (
                          <div className="mt-1 line-clamp-1 text-xs text-gray-600 dark:text-white/70">
                            {d.description}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(d.device_uid, d.name, d.description)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/5"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(d.device_uid, d.name)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/5"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link
                          to={`/devices/${encodeURIComponent(d.device_uid)}`}
                          className="inline-flex rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 no-underline dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
                  No devices match your search.
                </div>
              )}
            </div>
          )}

          {/* Add Device Modal */}
          <Modal open={addOpen} title="Add device" onClose={closeAdd}>
        {!createdToken ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs text-gray-600 dark:text-white/60">Name</div>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="My Controller-X"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:border-white/20"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-gray-600 dark:text-white/60">Description</div>
              <input
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                placeholder="Lab device"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:border-white/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeAdd}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
              >
                Create device
              </button>
            </div>

            <div className="text-xs text-gray-500 dark:text-white/50">
              You’ll get a claim token once — it will appear next.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-white/50">
                Claim token
              </div>
              <div className="mt-1 break-all font-mono text-xs">{createdToken}</div>
              <div className="mt-2 text-[11px] text-gray-500 dark:text-white/50">
                Use this token to authenticate the device during provisioning.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => copy(createdToken)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15"
                >
                  Copy token
                </button>
                {createdExpires && (
                  <div className="text-[11px] text-gray-500 dark:text-white/50">
                    Expires {new Date(createdExpires).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeAdd}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Device Modal */}
      <Modal open={editOpen} title="Edit device" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div className="text-xs text-gray-600 dark:text-white/60">
            Device UID: <span className="text-gray-800 dark:text-white/80">{editUid}</span>
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-600 dark:text-white/60">Name</div>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Friendly name"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:border-white/20"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-600 dark:text-white/60">Description</div>
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:border-white/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditOpen(false)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Device Modal */}
      <Modal open={deleteOpen} title="Delete device" onClose={closeDelete}>
        <div className="space-y-4">
          <div className="text-sm text-gray-700 dark:text-white/80">
            This action cannot be undone. The device and its data will be removed.
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-white/50">
              Device
            </div>
            <div className="mt-1 text-sm text-gray-900 dark:text-white/90">
              {deleteName || "Unnamed device"}
            </div>
            {deleteUid && (
              <div className="mt-1 break-all font-mono text-[11px] text-gray-500 dark:text-white/50">
                {deleteUid}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={closeDelete}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!deleteUid) return;
                await onDelete(deleteUid);
                closeDelete();
              }}
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-100 dark:hover:bg-red-500/25"
            >
              Delete device
            </button>
          </div>
        </div>
      </Modal>
        </>
      )}
    </div>
  );
}
