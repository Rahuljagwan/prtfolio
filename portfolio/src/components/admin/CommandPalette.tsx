"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";

interface Tab {
  key: string;
  label: string;
}

/** Cmd/Ctrl+K jump-to-section, mounted once in Dashboard. */
export function CommandPalette({ tabs, onSelect }: { tabs: Tab[]; onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = tabs.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog open={open} title="Jump to section" onClose={() => setOpen(false)}>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jump to..." autoFocus trailing={<Search size={14} className="text-muted-foreground" />} />
      <ul className="thin-scroll mt-3 max-h-72 space-y-1 overflow-y-auto">
        {matches.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => {
                onSelect(t.key);
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {t.label}
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>}
      </ul>
    </Dialog>
  );
}
