import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { safeCopy } from "../../utils/safeCopy";
import { useToast } from "./toast";

export function CodeBlock({
  title,
  code,
  language,
}: {
  title?: string;
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { push } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function onCopy() {
    const ok = await safeCopy(code);
    if (ok) {
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      push("Copied");
    } else {
      push("Copy failed, select manually");
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          {title && <div className="text-xs font-semibold text-gray-700 dark:text-white/80">{title}</div>}
          {language && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-gray-800 dark:text-white/90">
        <code className="whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  );
}
