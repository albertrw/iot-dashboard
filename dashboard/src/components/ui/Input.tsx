import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:border-white/20 dark:focus-visible:ring-emerald-400/20 ${className}`}
      {...props}
    />
  );
}
