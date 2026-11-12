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

/** Rebalance a macro ratio so the three percentages always total 100. */
export function rebalanceMacroRatio(
  ratio: { cho: number; pro: number; fat: number },
  changed: 'cho' | 'pro' | 'fat',
  value: number
): { cho: number; pro: number; fat: number } {
  const next = Math.max(0, Math.min(100, Math.round(value)))
  const others = (['cho', 'pro', 'fat'] as const).filter((key) => key !== changed)
  const remaining = 100 - next
  const sum = Math.max(0, numberValue(ratio[others[0]])) + Math.max(0, numberValue(ratio[others[1]]))
  const first = sum <= 0 ? Math.round(remaining / 2) : Math.round((Math.max(0, numberValue(ratio[others[0]])) / sum) * remaining)
  return { ...ratio, [changed]: next, [others[0]]: first, [others[1]]: remaining - first } as { cho: number; pro: number; fat: number }
}

/** Protein percentage implied by a g/kg guardrail at a given energy intake. */
export function proteinRatioFor(
  label: string,
  calories: number,
  weight: number,
  fatPercent: number
): { cho: number; pro: number; fat: number } | null {
  if (!calories || !weight) return null
  const numbers = label.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [1.2, 1.4]
  const low = numbers[0] ?? 1.2
  const high = numbers[1] ?? low + 0.2
  const mid = ((low + high) / 2) * weight
  const pro = Math.max(5, Math.min(60, Math.round(((mid * 4) / calories) * 100)))
  const fat = Math.max(5, Math.min(60, Math.round(fatPercent)))
  return { cho: Math.max(0, 100 - pro - fat), pro, fat }
}
