import React, { useEffect } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl dark:border-white/10 dark:bg-[#0b0f14] dark:text-white">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</div>
          <button
            className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/5"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
