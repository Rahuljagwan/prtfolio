"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { Resource } from "@/lib/admin/resources";
import { adminFetch, type Row } from "./client";
import { FieldForm, emptyValues } from "./FieldForm";

const pick = (row: Row, resource: Resource) =>
  Object.fromEntries(resource.fields.map((f) => [f.name, row[f.name]]));

function SortableRow({ row, resource, onEdit, onDelete }: { row: Row; resource: Resource; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const subtitle = resource.subtitleField ? String(row[resource.subtitleField] ?? "") : "";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${String(row[resource.titleField])}`}
        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{String(row[resource.titleField])}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <button type="button" onClick={onEdit} aria-label="Edit" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
        <Pencil size={15} />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-md p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
        <Trash2 size={15} />
      </button>
    </li>
  );
}

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: Row };

export function ResourceManager({ resource, initialRows }: { resource: Resource; initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [notice, setNotice] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const base = `/api/admin/${resource.key}`;
  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const previous = rows;
    const next = arrayMove(rows, rows.findIndex((r) => r.id === active.id), rows.findIndex((r) => r.id === over.id));
    setRows(next); // optimistic
    try {
      await adminFetch(`${base}/reorder`, "POST", { ids: next.map((r) => r.id) });
      flash("Order saved");
    } catch (e) {
      setRows(previous);
      flash(`Could not save order: ${(e as Error).message}`);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete this ${resource.singular}? This cannot be undone.`)) return;
    try {
      await adminFetch(`${base}/${row.id}`, "DELETE");
      setRows((r) => r.filter((x) => x.id !== row.id));
      flash("Deleted");
    } catch (e) {
      flash(`Could not delete: ${(e as Error).message}`);
    }
  };

  const save = async (values: Record<string, unknown>) => {
    if (mode.kind === "edit") {
      const updated = await adminFetch<Row>(`${base}/${mode.row.id}`, "PATCH", values);
      setRows((r) => r.map((x) => (x.id === updated.id ? updated : x)));
      flash("Saved");
    } else {
      const created = await adminFetch<Row>(base, "POST", values);
      setRows((r) => [...r, created]);
      flash("Added");
    }
    setMode({ kind: "closed" });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Drag the handle to reorder. Changes appear on the site immediately.</p>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={15} /> Add {resource.singular}
        </button>
      </div>

      {/* Fixed-height slot so the list never jumps when the notice appears or fades. */}
      <div role="status" aria-live="polite" className="mb-3 h-9">
        {notice && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Add your first {resource.singular}.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {rows.map((row) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  resource={resource}
                  onEdit={() => setMode({ kind: "edit", row })}
                  onDelete={() => remove(row)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {mode.kind !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={mode.kind === "edit" ? `Edit ${resource.singular}` : `Add ${resource.singular}`}
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm"
          onMouseDown={() => setMode({ kind: "closed" })}
        >
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="mb-5 text-lg font-semibold capitalize">
              {mode.kind === "edit" ? "Edit" : "Add"} {resource.singular}
            </h2>
            <FieldForm
              // Remount when switching rows so form state never leaks between items.
              key={mode.kind === "edit" ? mode.row.id : "new"}
              fields={resource.fields}
              initial={mode.kind === "edit" ? pick(mode.row, resource) : emptyValues(resource.fields)}
              submitLabel={mode.kind === "edit" ? "Save changes" : `Add ${resource.singular}`}
              onSubmit={save}
              onCancel={() => setMode({ kind: "closed" })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
