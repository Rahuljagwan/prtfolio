"use client";

import { useState } from "react";
import type { Field } from "@/lib/admin/resources";
import { adminFetch } from "./client";
import { FieldForm } from "./FieldForm";

interface SingletonEditorProps {
  fields: Field[];
  /** The stored row. It may carry id/updatedAt, which the API rejects, so only editable fields are used. */
  initial: Record<string, unknown>;
  endpoint: string;
  submitLabel: string;
  savedMessage: string;
}

/** Editor for single-row content (profile, journey intro): one form, one PUT. */
export function SingletonEditor({ fields, initial, endpoint, submitLabel, savedMessage }: SingletonEditorProps) {
  const [saved, setSaved] = useState(false);
  const editable = Object.fromEntries(fields.map((f) => [f.name, initial[f.name]]));

  return (
    <div className="max-w-2xl">
      {/* Fixed-height slot so the form never jumps when the message appears. */}
      <div role="status" aria-live="polite" className="mb-3 h-9">
        {saved && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{savedMessage}</p>}
      </div>
      <FieldForm
        fields={fields}
        initial={editable}
        submitLabel={submitLabel}
        onSubmit={async (values) => {
          setSaved(false);
          await adminFetch(endpoint, "PUT", values);
          setSaved(true);
        }}
      />
    </div>
  );
}
