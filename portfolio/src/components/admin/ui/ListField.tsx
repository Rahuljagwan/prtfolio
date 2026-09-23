"use client";

import { useRef, useState } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import type { Field } from "@/lib/admin/resources";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { MicButton } from "./MicButton";
import { IconButton } from "./IconButton";
import { SortableList, type SortableHandle } from "./SortableList";

interface Item {
  id: string;
  value: string;
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/**
 * Replaces the old up/down-arrow list editor with real drag-and-drop (via SortableList) and, for tag-like fields
 * (field.style === "chips"), a flex-wrap pill editor instead of one textarea per item. `string[]` has no stable id,
 * which @dnd-kit requires -- this component assigns one client-side uuid per item on mount and unwraps back to
 * plain strings on every onChange, so neither the parent form state nor the API ever sees the shim.
 */
export function ListField({
  field,
  value,
  onChange,
  fieldId,
}: {
  field: Extract<Field, { type: "list" }>;
  value: unknown;
  onChange: (v: unknown) => void;
  fieldId: string;
}) {
  const [items, setItems] = useState<Item[]>(() => ((value as string[]) ?? []).map((v) => ({ id: uid(), value: v })));
  const [draft, setDraft] = useState("");
  const chips = field.style === "chips";

  const commit = (next: Item[]) => {
    setItems(next);
    onChange(next.map((i) => i.value));
  };
  const updateValue = (id: string, v: string) => commit(items.map((i) => (i.id === id ? { ...i, value: v } : i)));
  const remove = (id: string) => commit(items.filter((i) => i.id !== id));
  const addEmpty = () => commit([...items, { id: uid(), value: "" }]);
  const addChip = (v: string) => {
    if (!v.trim()) return;
    commit([...items, { id: uid(), value: v.trim() }]);
  };

  if (chips) {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          <SortableList
            items={items}
            onReorder={commit}
            strategy="grid"
            renderItem={(item, handle, isDragging) => (
              <span
                ref={handle.setNodeRef}
                style={handle.style}
                className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1 pl-1 pr-2.5 text-sm ${isDragging ? "z-10 shadow-lg" : ""}`}
              >
                <button
                  type="button"
                  {...handle.attributes}
                  {...handle.listeners}
                  aria-label="Drag to reorder"
                  className="cursor-grab touch-none rounded-full p-1 text-muted-foreground hover:bg-background active:cursor-grabbing"
                >
                  <GripVertical size={12} />
                </button>
                {item.value}
                <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.value}`} className="text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              </span>
            )}
          />
        </div>
        <Input
          className="mt-2"
          value={draft}
          placeholder="Add and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addChip(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && items.length) {
              remove(items[items.length - 1].id);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SortableList
        items={items}
        onReorder={commit}
        renderItem={(item, handle, isDragging) => (
          <RowEditor
            key={item.id}
            fieldId={`${fieldId}-${item.id}`}
            item={item}
            handle={handle}
            isDragging={isDragging}
            onChange={(v) => updateValue(item.id, v)}
            onRemove={() => remove(item.id)}
          />
        )}
      />
      <button type="button" onClick={addEmpty} className="inline-flex items-center gap-1.5 text-sm text-primary">
        <Plus size={14} /> Add item
      </button>
    </div>
  );
}

function RowEditor({
  fieldId,
  item,
  handle,
  isDragging,
  onChange,
  onRemove,
}: {
  fieldId: string;
  item: Item;
  handle: SortableHandle;
  isDragging: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div ref={handle.setNodeRef as React.Ref<HTMLDivElement>} style={handle.style} className={`flex items-start gap-1 ${isDragging ? "z-10" : ""}`}>
      <button
        type="button"
        {...handle.attributes}
        {...handle.listeners}
        aria-label="Drag to reorder"
        className="mt-1.5 cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <Textarea
        ref={ref}
        aria-label="List item"
        rows={item.value.length > 90 ? 3 : 1}
        value={item.value}
        onChange={(e) => onChange(e.target.value)}
        trailing={<MicButton fieldId={fieldId} inputRef={ref} value={item.value} onChange={onChange} />}
      />
      <IconButton label="Remove" onClick={onRemove}>
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
}
