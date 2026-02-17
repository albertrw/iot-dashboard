import { NavLink, useNavigate } from "react-router-dom";
import { Cpu, LayoutGrid, LogOut, Wrench } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useAuth } from "../../auth/auth";
import { logout as apiLogout } from "../../api/auth";

const items = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/devices", label: "Devices", icon: Cpu },
  { to: "/technicians", label: "Technicians", icon: Wrench },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <aside className="hidden w-[260px] shrink-0 md:sticky md:top-20 md:block md:self-start">
      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="px-2 pb-2 text-xs font-semibold text-gray-500 dark:text-white/60">
          Workspace
        </div>

        <nav className="grid gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 no-underline hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/5",
                  isActive &&
                    "bg-gray-50 text-gray-900 dark:bg-white/10 dark:text-white"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="text-xs font-semibold text-gray-900 dark:text-white/80">Tip</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-white/60">
            Use manifests to auto-render sensors/actuators dynamically.
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-3 dark:border-white/10">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              apiLogout().catch(() => {});
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
