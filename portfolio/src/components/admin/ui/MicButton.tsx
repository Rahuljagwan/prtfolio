"use client";

import { useRef } from "react";
import { Mic } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { cn } from "@/lib/utils";

interface MicButtonProps {
  fieldId: string;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}

/**
 * Trailing mic button for Input/Textarea. Only renders when the browser exposes SpeechRecognition (Chrome/Edge) --
 * hidden, not disabled, everywhere else. Splices dictated text in at the cursor (or over a selection), replacing
 * the in-progress interim guess as it's corrected and folding each finished phrase in place so a paused-then-resumed
 * dictation session keeps appending rather than overwriting.
 */
export function MicButton({ fieldId, inputRef, value, onChange }: MicButtonProps) {
  const session = useRef<{ before: string; after: string; committed: string } | null>(null);

  const { supported, listening, toggle } = useVoiceInput(fieldId, (text, isFinal) => {
    const s = session.current;
    if (!s) return;
    const live = s.committed ? `${s.committed} ${text}` : text;
    onChange(`${s.before}${live}${s.after}`);
    if (isFinal) s.committed = live;
  });

  if (!supported) return null;

  const onClick = () => {
    if (!listening) {
      const el = inputRef.current;
      el?.focus();
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      session.current = { before: value.slice(0, start), after: value.slice(end), committed: "" };
    }
    toggle();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : "Dictate with voice"}
      title={listening ? "Stop dictation" : "Dictate with voice"}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-full transition-colors",
        listening ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Mic size={13} />
    </button>
  );
}
