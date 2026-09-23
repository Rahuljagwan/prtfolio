"use client";

import type { Field } from "@/lib/admin/resources";
import { formatRelativeTime } from "@/lib/admin/time";
import { useAdminMutation } from "./useAdminMutation";
import { useToast } from "./ui/Toast";
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
  const adminFetch = useAdminMutation();
  const toast = useToast();
  const editable = Object.fromEntries(fields.map((f) => [f.name, initial[f.name]]));
  const relative = formatRelativeTime(initial.updatedAt as string | undefined);

  return (
    <div className="max-w-2xl">
      {relative && <p className="mb-3 text-xs text-muted-foreground">Last edited {relative}</p>}
      <FieldForm
        fields={fields}
        initial={editable}
        submitLabel={submitLabel}
        draftKey={endpoint}
        onSubmit={async (values) => {
          await adminFetch(endpoint, "PUT", values);
          toast({ tone: "success", message: savedMessage });
        }}
      />
    </div>
  );
}
