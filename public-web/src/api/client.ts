const base = () => import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base) return `${base}${p}`;
  return p;
}

export async function apiFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<Response> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), {
    ...rest,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}
