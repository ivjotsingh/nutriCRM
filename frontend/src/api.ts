import type { IntakePayload, LeadDetail, LeadListItem, LeadResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function submitIntake(payload: IntakePayload): Promise<LeadResponse> {
  return request<LeadResponse>('/api/intakes', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function submitCheckIn(
  leadId: string,
  payload: {
    day_number: number
    adherence: string
    hunger: string
    energy: string
    digestion: string
    cravings: string
    notes: string
  }
) {
  return request(`/api/leads/${leadId}/check-ins`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function submitUpgradeIntent(
  leadId: string,
  payload: { plan_type: string; contact_preference: string; message: string }
) {
  return request(`/api/leads/${leadId}/upgrade-intent`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function listLeads(): Promise<{ leads: LeadListItem[] }> {
  return request<{ leads: LeadListItem[] }>('/api/leads')
}

export function getLead(leadId: string): Promise<LeadDetail> {
  return request<LeadDetail>(`/api/leads/${leadId}`)
}

export function recordEvent(eventType: string, leadId?: string, payload: Record<string, unknown> = {}) {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType, lead_id: leadId, payload })
  }).catch(() => undefined)
}

