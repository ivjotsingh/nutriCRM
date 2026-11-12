import type { Dish, PlanData, PlanDetail, PlanReference, PlanSummary } from './types'

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
      throw new ApiError(typeof detail.message === 'string' ? detail.message : 'This action could not be completed', Array.isArray(detail.blockers) ? detail.blockers : [])
    }
    if (typeof detail === 'string') throw new ApiError(detail)
    if (Array.isArray(detail)) throw new ApiError(detail.map((item) => item?.msg ?? 'Invalid input').join(' '))
    throw new ApiError(`Request failed with ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function listPlans(clientId: string): Promise<{ plans: PlanSummary[]; templates: { id: string; name: string; description: string }[] }> {
  return request(`/api/clients/${clientId}/plans`)
}

export function createPlan(clientId: string, payload: { name?: string; template_id?: string; strategy_id?: string }): Promise<PlanDetail> {
  return request(`/api/clients/${clientId}/plans`, { method: 'POST', body: JSON.stringify(payload) })
}

export function getPlan(clientId: string, planId: string): Promise<PlanDetail> {
  return request(`/api/clients/${clientId}/plans/${planId}`)
}

export function updatePlan(clientId: string, planId: string, payload: { name?: string; data?: PlanData }): Promise<PlanDetail> {
  return request(`/api/clients/${clientId}/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function publishPlan(clientId: string, planId: string, payload: { attestation: boolean; note: string }): Promise<PlanDetail> {
  return request(`/api/clients/${clientId}/plans/${planId}/publish`, { method: 'POST', body: JSON.stringify(payload) })
}

export function createPlanRevision(clientId: string, planId: string): Promise<PlanDetail> {
  return request(`/api/clients/${clientId}/plans/${planId}/revisions`, { method: 'POST' })
}

export function duplicatePlan(clientId: string, planId: string): Promise<PlanDetail> {
  return request(`/api/clients/${clientId}/plans/${planId}/duplicate`, { method: 'POST' })
}

export function deletePlan(clientId: string, planId: string): Promise<void> {
  return request(`/api/clients/${clientId}/plans/${planId}`, { method: 'DELETE' })
}

export function planPdfUrl(clientId: string, planId: string, options: { download?: boolean; version?: number } = {}): string {
  const params = new URLSearchParams()
  if (options.download) params.set('download', 'true')
  if (options.version) params.set('version', String(options.version))
  params.set('t', String(Date.now()))
  return `${API_BASE}/api/clients/${clientId}/plans/${planId}/pdf?${params.toString()}`
}

export async function fetchPlanPdf(clientId: string, planId: string): Promise<Blob> {
  const response = await fetch(planPdfUrl(clientId, planId))
  if (!response.ok) throw new ApiError('Unable to render the plan PDF')
  return response.blob()
}

export function savePlanTemplate(clientId: string, planId: string, payload: { name: string; description: string }): Promise<{ id: string; name: string }> {
  return request(`/api/clients/${clientId}/plans/${planId}/template`, { method: 'POST', body: JSON.stringify(payload) })
}

export function getReference(): Promise<PlanReference> {
  return request('/api/plan-reference')
}

export function getCatalog(): Promise<{ units: { unit: string; grams: number }[]; categories: string[]; dishes: Dish[] }> {
  return request('/api/plan-catalog')
}
