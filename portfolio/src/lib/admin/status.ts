// Tiny external store for "is a mutation in flight right now, and how did it end" -- read by StatusOrb and the
// admin 3D backdrop's tint, written by useAdminMutation. Deliberately not React state: it's read from two unrelated
// components that shouldn't need a shared parent or prop drilling.

export type AdminStatus = "idle" | "pending" | "success" | "error";

let status: AdminStatus = "idle";
const listeners = new Set<() => void>();
let resetTimer: ReturnType<typeof setTimeout> | undefined;

export function getAdminStatus(): AdminStatus {
  return status;
}

export function setAdminStatus(next: AdminStatus) {
  status = next;
  listeners.forEach((l) => l());
  clearTimeout(resetTimer);
  if (next === "success" || next === "error") {
    resetTimer = setTimeout(() => setAdminStatus("idle"), 1600);
  }
}

export function subscribeAdminStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
