import { PropsWithChildren } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0b0f14] dark:text-white">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-4 py-4">
        <Sidebar />
        <main className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          {children}
        </main>
      </div>
    </div>
  );
}
