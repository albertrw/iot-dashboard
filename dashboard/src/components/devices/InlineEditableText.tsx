import { useState } from "react";
import { Check, X } from "lucide-react";

export default function InlineEditableText({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <h2
        className="font-medium cursor-pointer hover:underline"
        onClick={() => setEditing(true)}
      >
        {value}
      </h2>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="rounded border px-2 py-1 text-sm"
      />
      <button onClick={() => { onSave(draft); setEditing(false); }}>
        <Check size={16} />
      </button>
      <button onClick={() => { setDraft(value); setEditing(false); }}>
        <X size={16} />
      </button>
    </div>
  );
}
