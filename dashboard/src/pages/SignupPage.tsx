import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/toast";
import { useAuth } from "../auth/auth";

function isValidEmail(v: string) {
  return v.includes("@") && v.includes(".");
}

export function SignupPage() {
  const nav = useNavigate();
  const { push } = useToast();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e1 = email.trim().toLowerCase();
    if (!isValidEmail(e1)) return push("Enter a valid email");
    if (password.length < 8) return push("Password must be at least 8 characters");
    if (password !== confirm) return push("Passwords do not match");

    setLoading(true);
    try {
      await register(e1, password);
      nav("/", { replace: true });
    } catch (err: any) {
      push(err?.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0b0f14] dark:text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        <div className="text-center">
          <div className="text-2xl font-semibold">Create account</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-white/70">
            Start managing your devices
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
        >
          <label className="block text-sm font-medium text-gray-700 dark:text-white/80">
            Email
          </label>
          <Input
            className="mt-1 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
          />

          <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-white/80">
            Password
          </label>
          <Input
            className="mt-1 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />

          <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-white/80">
            Confirm password
          </label>
          <Input
            className="mt-1 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Repeat password"
          />

          <Button
            type="submit"
            variant="primary"
            className="mt-5 w-full"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create account"}
          </Button>

          <div className="mt-4 text-center text-sm text-gray-600 dark:text-white/70">
            Already have an account?{" "}
            <Link className="text-emerald-600 hover:underline dark:text-emerald-300" to="/login">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

