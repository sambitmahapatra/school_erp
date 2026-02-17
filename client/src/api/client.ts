export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("erp-token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined
  });
}

export async function apiPatch<T>(path: string, payload?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: payload ? JSON.stringify(payload) : undefined
  });
}

export async function apiDelete<T>(path: string, payload?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "DELETE",
    body: payload ? JSON.stringify(payload) : undefined
  });
}
