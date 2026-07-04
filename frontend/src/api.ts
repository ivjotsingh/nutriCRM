import type { IntakePayload, LeadDetail, LeadListItem, LeadResponse } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(formatApiError(body.detail, response.status))
  }
  return response.json() as Promise<T>
}

function formatApiError(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        const record = item as { loc?: unknown[]; msg?: unknown }
        const field = Array.isArray(record.loc) ? record.loc.filter((part) => part !== 'body').join('.') : ''
        const message = typeof record.msg === 'string' ? record.msg : ''
        return [field, message].filter(Boolean).join(': ')
      })
      .filter(Boolean)
    if (messages.length) return messages.join(' ')
  }
  return `Request failed with ${status}`
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
