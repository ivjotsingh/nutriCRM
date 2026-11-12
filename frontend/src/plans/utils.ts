import type { Meal, PlanData, PlanDay, Targets } from './types'

export function setByPath<T>(source: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  if (Array.isArray(source)) {
    const copy = source.slice()
    copy[Number(head)] = setByPath(copy[Number(head)], rest, value)
    return copy as unknown as T
  }
  const record = { ...(source as Record<string, unknown>) }
  record[String(head)] = setByPath(record[String(head)], rest, value)
  return record as T
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function formatShortDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
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

export function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function todayInput(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function portionText(qty: number, unit: string): string {
  const amount = Number.isInteger(qty) ? String(qty) : String(qty)
  return `${amount} ${unit}`.trim()
}

export function recalcMeal(meal: Meal): Meal {
  const qty = numberValue(meal.qty)
  return {
    ...meal,
    calories: round(qty * numberValue(meal.kcal_per_unit), 2),
    protein: round(qty * numberValue(meal.protein_per_unit), 2),
    carbs: round(qty * numberValue(meal.carbs_per_unit), 2),
    fat: round(qty * numberValue(meal.fat_per_unit), 2),
    portion: meal.portion?.trim() ? meal.portion : portionText(qty, meal.unit)
  }
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function dayTotals(day: PlanDay): { calories: number; protein: number; carbs: number; fat: number; meals: number } {
  const meals = day.slots.flatMap((slot) => slot.meals)
  return {
    calories: round(meals.reduce((total, meal) => total + numberValue(meal.calories), 0), 1),
    protein: round(meals.reduce((total, meal) => total + numberValue(meal.protein), 0), 1),
    carbs: round(meals.reduce((total, meal) => total + numberValue(meal.carbs), 0), 1),
    fat: round(meals.reduce((total, meal) => total + numberValue(meal.fat), 0), 1),
    meals: meals.length
  }
}

export function planTotals(data: PlanData): { calories: number; meals: number } {
  const active = data.days.filter((day) => day.active)
  return {
    calories: active.length ? Math.round(active.reduce((total, day) => total + dayTotals(day).calories, 0) / active.length) : 0,
    meals: active.reduce((total, day) => total + dayTotals(day).meals, 0)
  }
}

/** Keep the protein target, percentages and grams consistent (all three percentages total 100). */
export function ratioFromProtein(calories: number, proteinGrams: number, fatPercent: number): { cho: number; pro: number; fat: number } {
  const energy = numberValue(calories)
  if (!energy || !proteinGrams) return { cho: 100 - fatPercent, pro: 0, fat: fatPercent }
  const pro = Math.min(60, Math.max(5, Math.round(((proteinGrams * 4) / energy) * 100)))
  const fat = Math.min(60, Math.max(10, fatPercent))
  return { cho: Math.max(0, 100 - pro - fat), pro, fat }
}

/** Rebalance the two untouched macros proportionally when one percentage is edited. */
export function rebalanceRatio(
  ratio: { cho: number; pro: number; fat: number },
  changed: 'cho' | 'pro' | 'fat',
  value: number
): { cho: number; pro: number; fat: number } {
  const next = Math.max(0, Math.min(100, Math.round(value)))
  const keys = (['cho', 'pro', 'fat'] as const).filter((key) => key !== changed) as ('cho' | 'pro' | 'fat')[]
  const remaining = 100 - next
  const [firstKey, secondKey] = keys
  const sumOthers = Math.max(0, numberValue(ratio[firstKey])) + Math.max(0, numberValue(ratio[secondKey]))
  const first = sumOthers <= 0 ? Math.round(remaining / 2) : Math.round((Math.max(0, numberValue(ratio[firstKey])) / sumOthers) * remaining)
  const second = remaining - first
  return {
    ...ratio,
    [changed]: next,
    [firstKey]: first,
    [secondKey]: second
  } as { cho: number; pro: number; fat: number }
}

export function gramsFromRatio(calories: number, ratio: { cho: number; pro: number; fat: number }): { protein: number; carbs: number; fat: number } {
  const energy = numberValue(calories)
  return {
    protein: Math.round((energy * numberValue(ratio.pro)) / 100 / 4),
    carbs: Math.round((energy * numberValue(ratio.cho)) / 100 / 4),
    fat: Math.round((energy * numberValue(ratio.fat)) / 100 / 9)
  }
}

export function applyTargets(calories: number, ratio: { cho: number; pro: number; fat: number }): Targets {
  const grams = gramsFromRatio(calories, ratio)
  return {
    calories: Math.round(calories),
    protein_g: grams.protein,
    carbs_g: grams.carbs,
    fat_g: grams.fat,
    ratio: { ...ratio },
    source: 'manual',
    note: ''
  }
}

export function dayStatusLabel(status: string): string {
  switch (status) {
    case 'on-target':
      return 'On target'
    case 'near':
      return 'Near target'
    case 'off-target':
      return 'Off target'
    case 'empty':
      return 'No meals'
    case 'rest':
      return 'Rest day'
    case 'no-target':
      return 'No target'
    default:
      return status
  }
}
