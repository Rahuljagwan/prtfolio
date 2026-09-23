"use client";

import { useCallback } from "react";
import { setAdminStatus } from "@/lib/admin/status";
import { adminFetch } from "./client";

/**
 * Wraps adminFetch with the shared status store (StatusOrb + AdminBackdrop both read it): pending before the call,
 * success/error after, auto-clearing back to idle. Same signature and throw behaviour as adminFetch, so call sites
 * barely change.
 */
export function useAdminMutation() {
  return useCallback(async <T = unknown>(url: string, method: string, body?: unknown): Promise<T> => {
    setAdminStatus("pending");
    try {
      const result = await adminFetch<T>(url, method, body);
      setAdminStatus("success");
      return result;
    } catch (err) {
      setAdminStatus("error");
      throw err;
    }
  }, []);
}
