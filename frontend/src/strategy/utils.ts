import type { MacroDay, StrategyData } from './types'

export function setByPath<T>(source: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  if (Array.isArray(source)) {
    const copy = source.slice()
    const index = Number(head)
    copy[index] = setByPath(copy[index], rest, value)
    return copy as unknown as T
  }
  const record = { ...(source as Record<string, unknown>) }
  record[String(head)] = setByPath(record[String(head)], rest, value)
  return record as T
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function replaceDay(data: StrategyData, next: MacroDay): StrategyData {
  return {
    ...data,
    macros: {
      ...data.macros,
      days: data.macros.days.map((day) => (day.day === next.day ? next : day))
    }
  }
}

export function formatShortDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatShortDate(value)
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'N'
  )
}

export function todayInput(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function percent(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export function joinList(values: string[], fallback = '—'): string {
  return values.length ? values.join(' · ') : fallback
}
