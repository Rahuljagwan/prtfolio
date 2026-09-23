"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// Minimal ambient shape for the Web Speech API -- not in lib.dom.d.ts, and only Chrome/Edge ship it (webkit-prefixed).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const Ctor = getCtor();
export const VOICE_INPUT_SUPPORTED = Boolean(Ctor);

const SILENCE_TIMEOUT_MS = 4000;

// Module-level singleton: only one field may dictate at a time (Chrome doesn't handle concurrent recognizers well,
// and it's also the actual product requirement). Exposed per-field via useSyncExternalStore so each mic button's
// "am I the one listening" boolean is correct without prop drilling or a context provider.
let recognition: SpeechRecognitionLike | null = null;
let activeFieldId: string | null = null;
let activeInsert: ((text: string, isFinal: boolean) => void) | null = null;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function ensureRecognition(): SpeechRecognitionLike | null {
  if (!Ctor) return null;
  if (!recognition) {
    recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.onresult = (e) => {
      clearTimeout(silenceTimer);
      let text = "";
      let isFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      activeInsert?.(text, isFinal);
      silenceTimer = setTimeout(() => recognition?.stop(), SILENCE_TIMEOUT_MS);
    };
    recognition.onerror = () => {
      activeFieldId = null;
      activeInsert = null;
      notify();
    };
    recognition.onend = () => {
      activeFieldId = null;
      activeInsert = null;
      notify();
    };
  }
  return recognition;
}

function start(fieldId: string, insert: (text: string, isFinal: boolean) => void) {
  const r = ensureRecognition();
  if (!r) return;
  if (activeFieldId && activeFieldId !== fieldId) r.stop(); // switching fields: clean stop of whatever was active
  activeFieldId = fieldId;
  activeInsert = insert;
  notify();
  try {
    r.start();
  } catch {
    // start() throws if already started (e.g. re-clicking fast) -- ignorable, recognition keeps running.
  }
  silenceTimer = setTimeout(() => r.stop(), SILENCE_TIMEOUT_MS);
}

function stop() {
  recognition?.stop();
}

/** Per-field hook: `listening` is only true for the one field currently claiming the shared recognizer. */
export function useVoiceInput(fieldId: string, insert: (text: string, isFinal: boolean) => void) {
  const insertRef = useRef(insert);
  insertRef.current = insert;

  const listening = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => activeFieldId === fieldId,
    () => false,
  );

  useEffect(() => () => {
    if (activeFieldId === fieldId) stop();
  }, [fieldId]);

  const toggle = useCallback(() => {
    if (activeFieldId === fieldId) stop();
    else start(fieldId, (text, isFinal) => insertRef.current(text, isFinal));
  }, [fieldId]);

  return { supported: VOICE_INPUT_SUPPORTED, listening, toggle };
}
