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
    "inline-flex items-center justify-center gap-2 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes =
    size === "icon"
      ? "h-9 w-9 p-0"
      : size === "sm"
      ? "px-3 py-1.5 text-sm"
      : "px-4 py-2 text-sm";

  const variants =
    variant === "primary"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
      : variant === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
      : variant === "ghost"
      ? "border-transparent bg-transparent text-white/70 hover:bg-white/5"
      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10";

  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />;
}
