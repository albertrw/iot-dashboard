import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/toast";
import { useAuth } from "../auth/auth";
import { changePassword, updateProfile } from "../api/auth";
import { AVATARS, isAvatarKey } from "../auth/avatars";

export function ProfilePage() {
  const { user, setSession, updateUser } = useAuth();
  const { push } = useToast();

  const email = user?.email ?? "";
  const avatarKey = isAvatarKey(user?.avatar_key) ? user?.avatar_key : null;
  const initials = useMemo(() => (email.trim()?.[0] ?? "U").toUpperCase(), [email]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);

  async function onPickAvatar(nextKey: string | null) {
    if (!user) return;
    if (nextKey === avatarKey) return;
    setAvatarLoading(true);
    try {
      const res = await updateProfile({ avatar_key: nextKey });
      updateUser(res.user);
      push("Avatar updated");
    } catch (err: any) {
      push(err?.message ?? "Failed to update avatar");
    } finally {
      setAvatarLoading(false);
    }
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!avatarOpen) return;
      if (!avatarRef.current) return;
      if (!avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [avatarOpen]);

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 8) return setPasswordError("New password must be at least 8 characters");
    if (newPassword !== confirm) return setPasswordError("Passwords do not match");
    if (!currentPassword) return setPasswordError("Enter your current password");

    setLoading(true);
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSession(res.token, res.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setPasswordSuccess("Password updated");
    } catch (err: any) {
      setPasswordError(err?.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {avatarKey ? (
          <img
            src={`/avatars/${avatarKey}.svg`}
            alt="Avatar"
            className="h-11 w-11 rounded-2xl border border-gray-200 bg-gray-50 object-cover dark:border-white/10 dark:bg-white/5"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-gray-900 dark:text-white/90">
            Profile
          </div>
          <div className="truncate text-sm text-gray-600 dark:text-white/60">{email}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Avatar
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-white/60">
              Choose an avatar for your account.
            </div>
          </div>
          {avatarLoading && (
            <div className="text-xs text-gray-500 dark:text-white/60">Saving...</div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {avatarKey ? (
            <img
              src={`/avatars/${avatarKey}.svg`}
              alt="Avatar"
              className="h-12 w-12 rounded-2xl border border-gray-200 bg-gray-50 object-cover dark:border-white/10 dark:bg-white/5"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              {initials}
            </div>
          )}

          <div className="relative" ref={avatarRef}>
            <Button
              variant="secondary"
              onClick={() => setAvatarOpen((v) => !v)}
              disabled={avatarLoading}
            >
              Change avatar
            </Button>

            {avatarOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0b0f14]">
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white/80">
                  Select an avatar
                </div>
                <div className="grid grid-cols-5 gap-2 px-3 pb-3">
                  {AVATARS.map((a) => {
                    const selected = a.key === avatarKey;
                    return (
                      <button
                        key={a.key ?? "default"}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onPickAvatar(a.key);
                          setAvatarOpen(false);
                        }}
                        className={`rounded-2xl border p-1 transition-colors ${
                          selected
                            ? "border-emerald-400 bg-emerald-50 dark:border-emerald-300/60 dark:bg-emerald-500/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        }`}
                        aria-label={`Select ${a.label}`}
                        title={a.label}
                      >
                        {a.key ? (
                          <img
                            src={`/avatars/${a.key}.svg`}
                            alt={a.label}
                            className="h-10 w-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/30 text-sm font-semibold text-gray-900 dark:bg-white/10 dark:text-white/90">
                            {initials}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="text-sm font-semibold text-gray-900 dark:text-white/90">
          Change password
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-white/60">
          After changing your password, your other sessions will be signed out.
        </div>

        <form onSubmit={onChangePassword} className="mt-4 grid gap-3">
          {passwordError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {passwordError}
            </div>
          ) : null}
          {passwordSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              {passwordSuccess}
            </div>
          ) : null}

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">
              Current password
            </label>
            <Input
              className="mt-1 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">
              New password
            </label>
            <Input
              className="mt-1 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-white/70">
              Confirm new password
            </label>
            <Input
              className="mt-1 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="mt-1 flex justify-end">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Saving..." : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
