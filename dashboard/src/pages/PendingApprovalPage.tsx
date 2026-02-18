import { Link, useLocation } from "react-router-dom";

export function PendingApprovalPage() {
  const location = useLocation();
  const email = (location.state as any)?.email;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0b0f14] dark:text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        <div className="text-center">
          <div className="text-2xl font-semibold">Account pending approval</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-white/70">
            Your account was created successfully, but needs manual approval before you can sign in.
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          {typeof email === "string" && email ? (
            <div className="text-sm text-gray-700 dark:text-white/80">
              Email: <span className="font-semibold">{email}</span>
            </div>
          ) : null}

          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-white/80">
            <li>Wait for an admin to approve your account.</li>
            <li>After approval, you can sign in and start adding devices.</li>
          </ul>

          <div className="mt-5 text-center text-sm text-gray-600 dark:text-white/70">
            <Link className="text-emerald-600 hover:underline dark:text-emerald-300" to="/login">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

