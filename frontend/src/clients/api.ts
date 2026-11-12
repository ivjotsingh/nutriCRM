import type { ClientBundle, ClientRecord, CustomTabField, HeadToeSnapshot, TabDef } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail
    if (typeof detail === 'string') throw new Error(detail)
    if (Array.isArray(detail)) {
      throw new Error(detail.map((item) => item?.msg ?? 'Invalid input').join(' '))
    }
    throw new Error(`Request failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function listClients(): Promise<{ clients: ClientRecord[] }> {
  return request('/api/clients')
}

export function createClient(payload: {
  name: string
  phone: string
  email: string
  city: string
  consent: boolean
  start_date: string
  end_date: string
}): Promise<ClientBundle> {
  return request('/api/clients', { method: 'POST', body: JSON.stringify(payload) })
}

export function getClient(clientId: string): Promise<ClientBundle> {
  return request(`/api/clients/${clientId}`)
}

export function updateClient(
  clientId: string,
  payload: {
    name: string
    phone: string
    email: string
    city: string
    consent: boolean
    start_date: string
    end_date: string
    data: Record<string, unknown>
  }
): Promise<ClientBundle> {
  return request(`/api/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function addClientOption(clientId: string, category: string, value: string): Promise<{ options: string[] }> {
  return request(`/api/clients/${clientId}/options`, {
    method: 'POST',
    body: JSON.stringify({ category, value })
  })
}

export function createClientTab(
  clientId: string,
  payload: { label: string; description: string; fields: CustomTabField[] }
): Promise<{ tab: TabDef }> {
  return request(`/api/clients/${clientId}/tabs`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getHeadToeHistory(clientId: string): Promise<{ history: HeadToeSnapshot[] }> {
  return request(`/api/clients/${clientId}/headtoe/history`)
}
