const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export function setAccessToken(token: string | null) { accessToken = token }
export function getAccessToken() { return accessToken }

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (!r.ok) { accessToken = null; return null }
      const d = await r.json()
      accessToken = d.token
      return accessToken
    } finally { refreshPromise = null }
  })()
  return refreshPromise
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (options.body !== undefined && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const r = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' })

  if (r.status === 401 && retry) {
    const token = await refreshAccessToken()
    if (token) return request<T>(path, options, false)
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (r.status === 204) return undefined as T
  const data = await r.json()
  if (!r.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: r.status, code: data.code, errors: data.errors })
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
}

export default api
