import type { StrategyData, StrategyDetail, StrategySummary } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export class ApiError extends Error {
  blockers: { id: string; label: string; detail: string; section: string }[]

  constructor(message: string, blockers: { id: string; label: string; detail: string; section: string }[] = []) {
    super(message)
    this.name = 'ApiError'
    this.blockers = blockers
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      throw new ApiError(
        typeof detail.message === 'string' ? detail.message : 'This action could not be completed',
        Array.isArray(detail.blockers) ? detail.blockers : []
      )
    }
    if (typeof detail === 'string') throw new ApiError(detail)
    if (Array.isArray(detail)) {
      throw new ApiError(detail.map((item) => item?.msg ?? 'Invalid input').join(' '))
    }
    throw new ApiError(`Request failed with ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function listStrategies(clientId: string): Promise<{ strategies: StrategySummary[] }> {
  return request(`/api/clients/${clientId}/strategies`)
}

export function createStrategy(clientId: string, name = ''): Promise<StrategyDetail> {
  return request(`/api/clients/${clientId}/strategies`, {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}

export function getStrategy(clientId: string, strategyId: string): Promise<StrategyDetail> {
  return request(`/api/clients/${clientId}/strategies/${strategyId}`)
}

export function updateStrategy(
  clientId: string,
  strategyId: string,
  payload: { name?: string; data?: StrategyData }
): Promise<StrategyDetail> {
  return request(`/api/clients/${clientId}/strategies/${strategyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function publishStrategy(
  clientId: string,
  strategyId: string,
  payload: { attestation: boolean; note: string }
): Promise<StrategyDetail> {
  return request(`/api/clients/${clientId}/strategies/${strategyId}/publish`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function createRevision(clientId: string, strategyId: string): Promise<StrategyDetail> {
  return request(`/api/clients/${clientId}/strategies/${strategyId}/revisions`, {
    method: 'POST'
  })
}

export function refreshStrategy(
  clientId: string,
  strategyId: string,
  scope: 'clinical' | 'body' | 'support' | 'all'
): Promise<StrategyDetail> {
  return request(`/api/clients/${clientId}/strategies/${strategyId}/refresh`, {
    method: 'POST',
    body: JSON.stringify({ scope })
  })
}

export function deleteStrategy(clientId: string, strategyId: string): Promise<void> {
  return request(`/api/clients/${clientId}/strategies/${strategyId}`, { method: 'DELETE' })
}
