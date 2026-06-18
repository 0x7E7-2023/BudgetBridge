export const getToken = () => localStorage.getItem('admin_token') ?? ''
export const setToken = (t: string) => localStorage.setItem('admin_token', t)
export const clearToken = () => localStorage.removeItem('admin_token')

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${getToken()}` },
  })
  if (res.status === 401) {
    clearToken()
    window.dispatchEvent(new Event('bb:unauthorized'))
  }
  return res
}
