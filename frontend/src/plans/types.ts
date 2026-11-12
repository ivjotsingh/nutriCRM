export type PlanStatus = 'draft' | 'published' | 'archived'

export type MealAlternative = {
  id: string
  name: string
  portion: string
  calories: number
}

export type Meal = {
  id: string
  food_id: string
  name: string
  qty: number
  unit: string
  portion: string
  grams_per_unit: number
  kcal_per_unit: number
  protein_per_unit: number
  carbs_per_unit: number
  fat_per_unit: number
  calories: number
  protein: number
  carbs: number
  fat: number
  note: string
  recipe: string
  alternatives: MealAlternative[]
}

export type Slot = {
  id: string
  name: string
  time: string
  note: string
  meals: Meal[]
}

export type Targets = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  ratio: { cho: number; pro: number; fat: number }
  protein_range?: string
  source: string
  note?: string
}

export type PlanDay = {
  day: string
  date: string
  active: boolean
  fast_day: boolean
  notes: string
  targets?: Targets
  slots: Slot[]
}

export type Brand = {
  name: string
  tagline: string
  email: string
  phone: string
  powered_by: string
  footer_note: string
}

export type CustomNote = { id: string; heading: string; body: string }

export type PlanExtras = {
  superfoods: string[]
  measurements: boolean
  guidelines: string[]
  disclaimer: boolean
  show_targets: boolean
  custom_notes: CustomNote[]
}

export type PlanGovernance = {
  reviewed_targets: boolean
  acknowledged_restrictions: boolean
  acknowledged_variance: boolean
}

export type PlanMeta = {
  title: string
  start_date: string
  end_date: string
  duration_days: number
  description: string
  diet_type: string
  strategy_id: string
  strategy_name: string
  template_id: string
  prepared_by: string
  approved_label: string
}

export type PlanClinical = {
  conditions: string[]
  allergies: string[]
  intolerances: string[]
  restrictions: string[]
  weight_kg: number
  height_cm: number
  goal: string
}

export type PlanData = {
  meta: PlanMeta
  brand: Brand
  targets: Targets
  days: PlanDay[]
  extras: PlanExtras
  governance: PlanGovernance
  clinical: PlanClinical
}

export type PlanRecord = {
  id: string
  client_id: string
  name: string
  status: PlanStatus
  version: number
  data: PlanData
  created_at: string
  updated_at: string
  published_at: string
}

export type DayDerived = {
  day: string
  date: string
  active: boolean
  fast_day: boolean
  notes: string
  calories: number
  protein: number
  carbs: number
  fat: number
  meals: number
  slots: number
  target_calories: number
  target_protein: number
  diff: number
  pct: number
  status: 'rest' | 'empty' | 'no-target' | 'on-target' | 'near' | 'off-target'
}

export type ReadinessCheck = {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
  section: string
}

export type Readiness = {
  score: number
  checks: ReadinessCheck[]
  blockers: ReadinessCheck[]
  ready: boolean
}

export type Warning = {
  id: string
  severity: 'info' | 'caution' | 'high'
  title: string
  message: string
  ack_key: string | null
  section: string
}

export type PlanDerived = {
  days: DayDerived[]
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    meals: number
    days: number
    days_with_meals: number
    avg_calories: number
  }
  conflicts: { day: string; slot: string; meal: string; reason: string }[]
  warnings: Warning[]
  readiness: Readiness
  context: Record<string, unknown>
}

export type Superfood = { id: string; name: string; note: string }
export type Guideline = { id: string; title: string; paragraphs: string[]; bullets?: string[]; after?: string[] }
export type SlotPreset = { name: string; time: string }
export type TemplateSummary = { id: string; name: string; description: string }

export type PlanReference = {
  days: string[]
  day_short: string[]
  slot_presets: SlotPreset[]
  superfoods: Superfood[]
  measurement_guide: string[]
  guidelines: Guideline[]
  disclaimer: string[]
  units: { unit: string; grams: number }[]
  categories: string[]
  brand: Brand
  templates: TemplateSummary[]
}

export type PlanDetail = {
  plan: PlanRecord
  client: { id: string; name: string; phone: string; email: string; city: string; start_date: string; end_date: string }
  client_data: Record<string, unknown>
  derived: PlanDerived
  readiness: Readiness
  reference: PlanReference
  strategy: { id: string; name: string; status: string; calories: number } | null
}

export type PlanSummary = {
  id: string
  name: string
  status: PlanStatus
  version: number
  title: string
  start_date: string
  duration_days: number
  diet_type: string
  strategy_name: string
  calories: number
  target_calories: number
  protein: number
  days_with_meals: number
  meals: number
  readiness: number
  updated_at: string
  created_at: string
  published_at: string
}

export type Dish = {
  id: string
  name: string
  category: string
  unit: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  diet: string[]
  source: string
}

export type PlanSectionId = 'details' | 'targets' | 'week' | 'library' | 'guidelines' | 'preview' | 'review'
