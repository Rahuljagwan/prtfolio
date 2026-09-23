"use client";

import { useMemo, useState } from "react";
import { Copy, GripVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Resource } from "@/lib/admin/resources";
import { formatRelativeTime } from "@/lib/admin/time";
import { type Row } from "./client";
import { useAdminMutation } from "./useAdminMutation";
import { useToast } from "./ui/Toast";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { SortableList, type SortableHandle } from "./ui/SortableList";
import { FieldForm, emptyValues } from "./FieldForm";

function RowCard({
  row,
  resource,
  handle,
  isDragging,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  row: Row;
  resource: Resource;
  handle?: SortableHandle;
  isDragging?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const subtitle = resource.subtitleField ? String(row[resource.subtitleField] ?? "") : "";
  const relative = formatRelativeTime(row.updatedAt as string | undefined);
  return (
    <li
      ref={handle?.setNodeRef as React.Ref<HTMLLIElement>}
      style={handle?.style}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      {handle ? (
        <button
          type="button"
          aria-label={`Drag to reorder ${String(row[resource.titleField])}`}
          className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...handle.attributes}
          {...handle.listeners}
        >
          <GripVertical size={16} />
        </button>
      ) : (
        <span className="w-6" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{String(row[resource.titleField])}</p>
        <p className="truncate text-sm text-muted-foreground">
          {subtitle}
          {subtitle && relative && " · "}
          {relative && `edited ${relative}`}
        </p>
      </div>
      <button type="button" onClick={onDuplicate} aria-label="Duplicate" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
        <Copy size={15} />
      </button>
      <button type="button" onClick={onEdit} aria-label="Edit" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
        <Pencil size={15} />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-md p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
        <Trash2 size={15} />
      </button>
    </li>
  );
}

const pick = (row: Row, resource: Resource) => Object.fromEntries(resource.fields.map((f) => [f.name, row[f.name]]));

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: Row };

const SEARCH_THRESHOLD = 6;

export function ResourceManager({ resource, initialRows }: { resource: Resource; initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [query, setQuery] = useState("");
  const adminFetch = useAdminMutation();
  const toast = useToast();

  const base = `/api/admin/${resource.key}`;

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const title = String(r[resource.titleField] ?? "").toLowerCase();
      const subtitle = resource.subtitleField ? String(r[resource.subtitleField] ?? "").toLowerCase() : "";
      return title.includes(q) || subtitle.includes(q);
    });
  }, [rows, query, resource]);

  const onReorder = async (next: Row[]) => {
    const previous = rows;
    setRows(next); // optimistic
    try {
      await adminFetch(`${base}/reorder`, "POST", { ids: next.map((r) => r.id) });
    } catch (e) {
      setRows(previous);
      toast({ tone: "error", message: `Could not save order: ${(e as Error).message}` });
    }
  };

  const remove = (row: Row) => {
    const previous = rows;
    setRows((r) => r.filter((x) => x.id !== row.id)); // optimistic: nothing is sent to the server until the toast expires
    let undone = false;
    toast({
      tone: "info",
      message: `Deleted "${String(row[resource.titleField])}"`,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          setRows(previous);
        },
      },
    });
    setTimeout(async () => {
      if (undone) return;
      try {
        await adminFetch(`${base}/${row.id}`, "DELETE");
      } catch (e) {
        setRows(previous);
        toast({ tone: "error", message: `Could not delete: ${(e as Error).message}` });
      }
    }, 5000);
  };

  const duplicate = async (row: Row) => {
    try {
      const created = await adminFetch<Row>(base, "POST", pick(row, resource));
      setRows((r) => [...r, created]);
      toast({ tone: "success", message: `Duplicated "${String(row[resource.titleField])}"` });
    } catch (e) {
      toast({ tone: "error", message: `Could not duplicate: ${(e as Error).message}` });
    }
  };

  const save = async (values: Record<string, unknown>) => {
    if (mode.kind === "edit") {
      const updated = await adminFetch<Row>(`${base}/${mode.row.id}`, "PATCH", values);
      setRows((r) => r.map((x) => (x.id === updated.id ? updated : x)));
      toast({ tone: "success", message: "Saved" });
    } else {
      const created = await adminFetch<Row>(base, "POST", values);
      setRows((r) => [...r, created]);
      toast({ tone: "success", message: `Added ${resource.singular}` });
    }
    setMode({ kind: "closed" });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Drag the handle to reorder. Changes appear on the site immediately.</p>
        <Button onClick={() => setMode({ kind: "create" })}>
          <Plus size={15} /> Add {resource.singular}
        </Button>
      </div>

      {rows.length > SEARCH_THRESHOLD && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${resource.label.toLowerCase()}...`}
          className="mb-3"
          trailing={<Search size={14} className="text-muted-foreground" />}
        />
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? `Nothing here yet. Add your first ${resource.singular}.` : "No matches."}
        </p>
      ) : query.trim() ? (
        // Search results: reordering a filtered subset can't unambiguously map back onto the full list's order,
        // so drag is only available against the full, unfiltered list -- clear the search to reorder.
        <ul className="space-y-2">
          {filtered.map((row) => (
            <RowCard key={row.id} row={row} resource={resource} onEdit={() => setMode({ kind: "edit", row })} onDuplicate={() => duplicate(row)} onDelete={() => remove(row)} />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          <SortableList
            items={rows}
            onReorder={onReorder}
            renderItem={(row, handle, isDragging) => (
              <RowCard
                row={row}
                resource={resource}
                handle={handle}
                isDragging={isDragging}
                onEdit={() => setMode({ kind: "edit", row })}
                onDuplicate={() => duplicate(row)}
                onDelete={() => remove(row)}
              />
            )}
          />
        </ul>
      )}

      <Dialog open={mode.kind !== "closed"} title={mode.kind === "edit" ? `Edit ${resource.singular}` : `Add ${resource.singular}`} onClose={() => setMode({ kind: "closed" })}>
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
          draftKey={`${resource.key}:${mode.kind === "edit" ? mode.row.id : "new"}`}
        />
      </Dialog>
    </div>
  );
}
