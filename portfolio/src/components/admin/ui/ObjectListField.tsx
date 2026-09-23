"use client";

import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { Field } from "@/lib/admin/resources";
import { emptyValues } from "../FieldForm";
import { FieldShell } from "./FieldShell";
import { FieldInput } from "./FieldInput";
import { IconButton } from "./IconButton";
import { SortableList, type SortableHandle } from "./SortableList";

type Values = Record<string, unknown>;
interface Item {
  id: string;
  value: Values;
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/**
 * Replaces the objects field's bottom-right-trash-only card list with the same drag-reorder treatment as ListField
 * (used only by Profile's facts/highlights). Same client-side id shim as ListField -- JSON arrays have no stable id.
 */
export function ObjectListField({
  field,
  value,
  onChange,
  fieldId,
}: {
  field: Extract<Field, { type: "objects" }>;
  value: unknown;
  onChange: (v: unknown) => void;
  fieldId: string;
}) {
  const [items, setItems] = useState<Item[]>(() => ((value as Values[]) ?? []).map((v) => ({ id: uid(), value: v })));

  const commit = (next: Item[]) => {
    setItems(next);
    onChange(next.map((i) => i.value));
  };
  const updateSub = (id: string, sub: string, v: unknown) =>
    commit(items.map((i) => (i.id === id ? { ...i, value: { ...i.value, [sub]: v } } : i)));
  const remove = (id: string) => commit(items.filter((i) => i.id !== id));
  const add = () => commit([...items, { id: uid(), value: emptyValues(field.of) }]);

  return (
    <div className="space-y-3">
      <SortableList
        items={items}
        onReorder={commit}
        renderItem={(item, handle, isDragging) => (
          <Card key={item.id} fieldId={`${fieldId}-${item.id}`} of={field.of} item={item} handle={handle} isDragging={isDragging} onChange={updateSub} onRemove={() => remove(item.id)} />
        )}
      />
      <button type="button" onClick={add} className="inline-flex items-center gap-1.5 text-sm text-primary">
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

function Card({
  fieldId,
  of,
  item,
  handle,
  isDragging,
  onChange,
  onRemove,
}: {
  fieldId: string;
  of: Field[];
  item: Item;
  handle: SortableHandle;
  isDragging: boolean;
  onChange: (id: string, sub: string, v: unknown) => void;
  onRemove: () => void;
}) {
  return (
    <div
      ref={handle.setNodeRef as React.Ref<HTMLDivElement>}
      style={handle.style}
      className={`space-y-3 rounded-xl border border-border p-3 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          {...handle.attributes}
          {...handle.listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <IconButton label="Remove" variant="danger" onClick={onRemove}>
          <Trash2 size={14} />
        </IconButton>
      </div>
      {of.map((sub) => (
        <FieldShell key={sub.name} label={sub.label} htmlFor={`${fieldId}-${sub.name}`}>
          <FieldInput fieldId={`${fieldId}-${sub.name}`} field={sub} value={item.value[sub.name]} onChange={(v) => onChange(item.id, sub.name, v)} />
        </FieldShell>
      ))}
    </div>
  );
}
