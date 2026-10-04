"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Field } from "@/lib/admin/resources";
import { ApiError, formatIssues } from "./client";

type Values = Record<string, unknown>;

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

/** Empty value for a field, used when creating a new row or a new item in an objects list. */
export function emptyValues(fields: Field[]): Values {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.type === "list" || f.type === "objects" ? [] : f.type === "select" ? f.options[0] : ""]),
  );
}

function move<T>(arr: T[], from: number, to: number) {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function IconButton({ label, onClick, disabled, children }: React.PropsWithChildren<{ label: string; onClick: () => void; disabled?: boolean }>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.name}`;

  switch (field.type) {
    case "text":
      return <input id={id} className={inputClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <textarea id={id} rows={3} className={inputClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select id={id} className={inputClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "list": {
      const items = (value as string[]) ?? [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-1">
              <textarea
                aria-label={`${field.label} ${i + 1}`}
                rows={item.length > 90 ? 3 : 1}
                className={inputClass}
                value={item}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <IconButton label="Move up" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
                <ArrowUp size={14} />
              </IconButton>
              <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))}>
                <ArrowDown size={14} />
              </IconButton>
              <IconButton label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, ""])} className="inline-flex items-center gap-1.5 text-sm text-primary">
            <Plus size={14} /> Add item
          </button>
        </div>
      );
    }
    case "objects": {
      const items = (value as Values[]) ?? [];
      return (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border p-3">
              {field.of.map((sub) => (
                <label key={sub.name} className="block text-xs text-muted-foreground">
                  {sub.label}
                  <div className="mt-1 text-foreground">
                    <FieldInput
                      field={sub}
                      value={item[sub.name]}
                      onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [sub.name]: v } : x)))}
                    />
                  </div>
                </label>
              ))}
              <div className="flex justify-end">
                <IconButton label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, emptyValues(field.of)])} className="inline-flex items-center gap-1.5 text-sm text-primary">
            <Plus size={14} /> Add
          </button>
        </div>
      );
    }
  }
}

interface FieldFormProps {
  fields: Field[];
  initial: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel?: () => void;
}

export function FieldForm({ fields, initial, submitLabel, onSubmit, onCancel }: FieldFormProps) {
  const [values, setValues] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      await onSubmit(values);
    } catch (err) {
      const e = err as ApiError;
      setErrors(e.issues?.length ? formatIssues(e.issues) : [e.message || "Something went wrong"]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={`f-${f.name}`} className="mb-1.5 block text-sm font-medium">
            {f.label}
          </label>
          {"hint" in f && f.hint && <p className="mb-1.5 text-xs text-muted-foreground">{f.hint}</p>}
          <FieldInput field={f} value={values[f.name]} onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))} />
        </div>
      ))}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full border border-border px-5 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
