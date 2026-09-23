"use client";

import { useRef } from "react";
import type { Field } from "@/lib/admin/resources";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Select } from "./Select";
import { MicButton } from "./MicButton";
import { ListField } from "./ListField";
import { ObjectListField } from "./ObjectListField";

/** The one place a Field's `type` decides what renders. text/textarea/select render directly (with a voice mic
 * button); list/objects delegate to their own drag-reorder-capable components. */
export function FieldInput({ field, value, onChange, fieldId }: { field: Field; value: unknown; onChange: (v: unknown) => void; fieldId: string }) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  switch (field.type) {
    case "text":
      return (
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          id={fieldId}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          trailing={<MicButton fieldId={fieldId} inputRef={ref} value={(value as string) ?? ""} onChange={onChange} />}
        />
      );
    case "textarea":
      return (
        <Textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={fieldId}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          trailing={<MicButton fieldId={fieldId} inputRef={ref} value={(value as string) ?? ""} onChange={onChange} />}
        />
      );
    case "select":
      return (
        <Select id={fieldId} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "list":
      return <ListField field={field} value={value} onChange={onChange} fieldId={fieldId} />;
    case "objects":
      return <ObjectListField field={field} value={value} onChange={onChange} fieldId={fieldId} />;
  }
}
