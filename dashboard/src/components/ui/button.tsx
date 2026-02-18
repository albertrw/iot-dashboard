import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b0f14]";
  const sizes =
    size === "icon"
      ? "h-9 w-9 p-0"
      : size === "sm"
      ? "px-3 py-1.5 text-sm"
      : "px-4 py-2 text-sm";

  const variants =
    variant === "primary"
      ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
      : variant === "danger"
      ? "border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100 dark:hover:bg-red-500/20"
      : variant === "ghost"
      ? "border-transparent bg-transparent text-gray-700 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-white/5"
      : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10";

  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />;
}
