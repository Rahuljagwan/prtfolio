"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Field } from "@/lib/admin/resources";
import { schemaFor } from "@/lib/admin/resources";
import { ApiError, fieldErrors, formatIssues } from "./client";
import { FieldShell } from "./ui/FieldShell";
import { FieldInput } from "./ui/FieldInput";
import { Button } from "./ui/Button";

type Values = Record<string, unknown>;

/** Empty value for a field, used when creating a new row or a new item in an objects list. */
export function emptyValues(fields: Field[]): Values {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.type === "list" || f.type === "objects" ? [] : f.type === "select" ? f.options[0] : ""]),
  );
}

interface FieldFormProps {
  fields: Field[];
  initial: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel?: () => void;
  /** When set, drafts are debounce-saved to localStorage under this key and offered back on mount if unsaved. */
  draftKey?: string;
}

const draftStorageKey = (key: string) => `admin-draft:${key}`;

export function FieldForm({ fields, initial, submitLabel, onSubmit, onCancel, draftKey }: FieldFormProps) {
  const [values, setValues] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [draftBanner, setDraftBanner] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLDivElement>(null);

  const schema = useMemo(() => schemaFor(fields), [fields]);
  const validation = useMemo(() => schema.safeParse(values), [schema, values]);
  const clientErrors = validation.success ? {} : fieldErrors(validation.error.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message })));

  // Auto-focus the first field whenever a form mounts -- covers both "the Add/Edit modal just opened" and
  // "this singleton editor's tab just became active", with no special-casing per caller.
  useEffect(() => {
    firstFieldRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, []);

  // Autosave draft (opt-in via draftKey): debounced write, offered back on mount if it differs from initial.
  useEffect(() => {
    if (!draftKey) return;
    const raw = localStorage.getItem(draftStorageKey(draftKey));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (JSON.stringify(parsed) !== JSON.stringify(initial)) setDraftBanner(true);
      } catch {
        localStorage.removeItem(draftStorageKey(draftKey));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => localStorage.setItem(draftStorageKey(draftKey), JSON.stringify(values)), 800);
    return () => clearTimeout(t);
  }, [draftKey, values]);

  const clearDraft = () => draftKey && localStorage.removeItem(draftStorageKey(draftKey));

  // Cmd/Ctrl+S submits whichever form the user is actually in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && formRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.success) {
      setTouched(new Set(fields.map((f) => f.name)));
      const firstInvalid = fields.find((f) => clientErrors[f.name]);
      if (firstInvalid) formRef.current?.querySelector<HTMLElement>(`#f-${firstInvalid.name}`)?.focus();
      return;
    }
    setSaving(true);
    setErrors([]);
    setServerFieldErrors({});
    try {
      await onSubmit(values);
      clearDraft();
    } catch (err) {
      const e = err as ApiError;
      setErrors(e.issues?.length ? formatIssues(e.issues) : [e.message || "Something went wrong"]);
      setServerFieldErrors(e.issues?.length ? fieldErrors(e.issues) : {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      {draftBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span>Unsaved draft found from an earlier session.</span>
          <div className="flex gap-3">
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                const raw = draftKey && localStorage.getItem(draftStorageKey(draftKey));
                if (raw) setValues(JSON.parse(raw));
                setDraftBanner(false);
              }}
            >
              Restore
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={() => {
                clearDraft();
                setDraftBanner(false);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {fields.map((f, i) => {
        const error = touched.has(f.name) ? clientErrors[f.name] ?? serverFieldErrors[f.name] : serverFieldErrors[f.name];
        return (
          <div key={f.name} ref={i === 0 ? firstFieldRef : undefined} onBlur={() => setTouched((prev) => new Set(prev).add(f.name))}>
            <FieldShell label={f.label} htmlFor={`f-${f.name}`} hint={"hint" in f ? f.hint : undefined} error={error}>
              <FieldInput fieldId={`f-${f.name}`} field={f} value={values[f.name]} onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))} />
            </FieldShell>
          </div>
        );
      })}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
