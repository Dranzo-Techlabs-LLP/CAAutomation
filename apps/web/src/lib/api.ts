const BASE = '/api/v1';

let accessToken: string | null = localStorage.getItem('access_token');

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  // Some endpoints (notably DELETE handlers returning void) reply with 200/204
  // and an EMPTY body. Calling res.json() on that throws
  // "Unexpected end of JSON input", so read the text first and only parse when
  // there is actually content.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Download a binary file from the API and trigger a browser save dialog. */
export async function apiDownload(path: string, fallbackName = 'download.bin'): Promise<void> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  let res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${BASE}${path}`, { headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  // Prefer Content-Disposition filename; fall back to caller-provided name.
  const disp = res.headers.get('Content-Disposition') || '';
  const match = /filename\s*=\s*"?([^";]+)"?/i.exec(disp);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Upload a single file via multipart/form-data and return JSON response. */
export async function apiUpload<T = unknown>(
  path: string,
  file: File,
  fieldName = 'file',
): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const form = new FormData();
  form.append(fieldName, file);
  let res = await fetch(`${BASE}${path}`, { method: 'POST', body: form, headers });
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${BASE}${path}`, { method: 'POST', body: form, headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Upload failed: ${res.status}`);
  }
  return res.json();
}
