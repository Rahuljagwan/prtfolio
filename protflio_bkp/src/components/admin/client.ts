// Small fetch wrapper for the admin API. Throws an Error with a readable message on failure.

export class ApiError extends Error {
  issues: { path: (string | number)[]; message: string }[];
  constructor(message: string, issues: { path: (string | number)[]; message: string }[] = []) {
    super(message);
    this.issues = issues;
  }
}

export async function adminFetch<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, data.issues ?? []);
  return data as T;
}

/** Turns zod issues into short lines like "Title: Title is required". */
export function formatIssues(issues: ApiError["issues"]) {
  return issues.map((i) => `${i.path.join(" › ")}: ${i.message}`);
}

export type Row = { id: string } & Record<string, unknown>;
