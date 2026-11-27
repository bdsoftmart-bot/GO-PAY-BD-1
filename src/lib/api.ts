export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Ephemeral in-memory fallback session tokens for embedded iframe environments
// where third-party cookies may be restricted; never written to localStorage/sessionStorage.
let memoryUserSessionToken: string | null = null;
let memoryAdminSessionToken: string | null = null;

export function setMemoryUserToken(token: string | null): void {
  memoryUserSessionToken = token;
}

export function setMemoryAdminToken(token: string | null): void {
  memoryAdminSessionToken = token;
}

export function getAdminToken(): string | null {
  return memoryAdminSessionToken;
}

export function getUserToken(): string | null {
  return memoryUserSessionToken;
}

type RequestScope = 'public' | 'user' | 'admin';

async function request(
  scope: RequestScope,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: any
): Promise<any> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  };

  if (scope === 'user' && memoryUserSessionToken) {
    headers['X-User-Session'] = memoryUserSessionToken;
  } else if (scope === 'admin' && memoryAdminSessionToken) {
    headers['X-Admin-Session'] = memoryAdminSessionToken;
  }

  let fetchBody: BodyInit | undefined;
  if (body !== undefined && body !== null && method !== 'GET' && method !== 'DELETE') {
    if (body instanceof FormData) {
      fetchBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: fetchBody,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
  let payload: any = null;
  if (contentType.includes('application/json')) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  } else {
    const text = await res.text().catch(() => '');
    payload = text ? { message: text.slice(0, 240) } : null;
  }

  if (!res.ok || (payload && payload.success === false)) {
    const message =
      payload?.message ||
      (res.status === 503
        ? 'Server database is not configured or temporarily unavailable.'
        : res.status === 401
        ? 'Session expired. Please sign in again.'
        : `Request failed (${res.status})`);
    throw new ApiError(message, res.status, payload?.code, payload?.data);
  }

  return payload ?? { success: true, data: null };
}

export const api = {
  publicGet: (url: string) => request('public', 'GET', url),
  publicPost: (url: string, body?: any) => request('public', 'POST', url, body),

  userGet: (url: string) => request('user', 'GET', url),
  userPost: (url: string, body?: any) => request('user', 'POST', url, body),
  userPut: (url: string, body?: any) => request('user', 'PUT', url, body),
  userDelete: (url: string) => request('user', 'DELETE', url),

  adminGet: (url: string) => request('admin', 'GET', url),
  adminPost: (url: string, body?: any) => request('admin', 'POST', url, body),
  adminPut: (url: string, body?: any) => request('admin', 'PUT', url, body),
  adminDelete: (url: string) => request('admin', 'DELETE', url),
};
