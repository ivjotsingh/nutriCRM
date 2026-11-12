export type StrategyStatus = 'draft' | 'published' | 'archived'
export type SectionId = 'brief' | 'clinical' | 'targets' | 'macros' | 'food' | 'support' | 'review'

export interface StrategyMeta {
  name: string
  patient_type: string
  major_goal: string
  diet_type: string
  description: string
  blood_report_at: string
  delivery_at: string
  reason_for_delay: string
  duration_days: number
  revision_of?: string
}

export interface DerangedRow {
  group: string
  test: string
  value: string
  unit: string
  range: string
  flag: string
}

export interface StrategyClinical {
  goals: string[]
  areas: string[]
  conditions: string[]
  symptoms: string[]
  deranged: DerangedRow[]
  notes: string
  synced_at: string
  client_updated_at: string
}

export interface StrategyBody {
  height_cm: number
  weight_kg: number
  body_fat_pct: number
  fat_free_mass_kg: number
  target_weight_kg: number
  ideal_weight_kg: number
  ideal_weight_manual: number
  ideal_weight_method: 'devine' | 'bmi22' | 'manual'
  age: number
  sex: 'Female' | 'Male'
  life_stage: string
  activity_level: string
  goal_mode: 'loss' | 'maintenance' | 'gain'
  calorie_method: 'thumb' | 'bmr' | 'rda'
  workout_extra_kcal: number
  protein_target: string
}

export interface MacroRatio {
  cho: number
  pro: number
  fat: number
}

export interface MacroDay {
  day: string
  day_short?: string
  formula: 'thumb' | 'bmr' | 'rda'
  calories: number
  protein_target: string
  ratio: MacroRatio
  note: string
  active: boolean
  breakdown?: MacroBreakdown
  protein_range?: ProteinRange
  protein_per_kg?: number
  protein_status?: 'below' | 'within' | 'above' | 'unknown'
  complete?: boolean
}

export interface MacroBreakdown {
  ratio: MacroRatio
  pct_total: number
  kcal: { cho: number; pro: number; fat: number }
  grams: { cho: number; pro: number; fat: number }
}

export interface ProteinRange {
  range: string
  low: number
  high: number
  min_g: number
  max_g: number
  mid_g: number
}

export interface Superfood {
  name: string
  category: string
  panel: string
  points: number
  source: string
  recommendation: string
}

export interface SupplementRow {
  name: string
  quantity: number
  unit: string
  cal: number
  pro: number
  fat: number
  carb: number
  fibre: number
  source?: string
}

export interface MedicationRow {
  type: string
  name: string
  brand: string
  time: string
  quantity: number
  dosage_per: string
  composition: string
  taking_since: string
  changes: string
}

export interface StrategyGovernance {
  reviewed_clinical: boolean
  acknowledged_interactions: boolean
  acknowledged_low_calorie: boolean
  acknowledged_macro_deviation: boolean
  acknowledged_allergies: boolean
  acknowledged_target_bmi: boolean
  acknowledged_paediatric: boolean
  acknowledged_pregnancy: boolean
}

export interface StrategyData {
  meta: StrategyMeta
  clinical: StrategyClinical
  body: StrategyBody
  macros: { days: MacroDay[]; template?: { formula: string; protein_target: string } }
  food: {
    food_wise: string[]
    other_goals: string[]
    next_phase: string[]
    superfoods: Superfood[]
  }
  supplements: SupplementRow[]
  medications: { current: MedicationRow[] }
  recommendations: { weight: string; medical: string; symptoms: string; immunity: string }
  notes: { client_request: string; other: string; internal: string }
  governance: StrategyGovernance
}

export interface StrategyRecord {
  id: string
  client_id: string
  name: string
  status: StrategyStatus
  version: number
  data: StrategyData
  created_at: string
  updated_at: string
  published_at: string
}

export interface ClientSummary {
  id: string
  name: string
  phone: string
  email: string
  city: string
  consent: boolean
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export interface StrategySummary {
  id: string
  name: string
  status: StrategyStatus
  version: number
  diet_type: string
  major_goal: string
  patient_type: string
  calories: number
  protein: string
  days_complete: number
  readiness: number
  updated_at: string
  created_at: string
  published_at: string
}

export interface ClientContext {
  allergies: string[]
  intolerances: string[]
  restrictions: string[]
  diet: string
  conditions: string[]
  client_updated_at: string
}

export interface RdaRow {
  label?: string
  group: string
  category: string
  sex: string
  age_min: number
  age_max: number
  activity: string
  body_weight_kg: number
  energy_kcal: number
  protein_g: number
  energy_per_kg?: number
  protein_per_kg?: number
  energy_note?: string
}

export interface Reference {
  diets: string[]
  patient_types: string[]
  major_goals: string[]
  goal_modes: { value: string; label: string }[]
  activity_levels: { value: string; label: string; factor: number; thumb: string }[]
  thumb_factors: Record<string, Record<string, number>>
  protein_targets: string[]
  default_protein_targets: Record<string, string>
  ideal_weight_methods: { value: string; label: string; detail: string }[]
  life_stages: string[]
  rda_rows: RdaRow[]
  food_strategy_options: string[]
  other_goal_options: string[]
  next_phase_options: string[]
  superfoods: { name: string; category: string; panel: string; points: number; recommendation: string; allergens: string[]; diet: string[] }[]
  supplements: { name: string; unit: string; quantity: number; cal: number; pro: number; fat: number; carb: number; fibre: number }[]
  interaction_rules: { label: string; severity: string; message: string }[]
  formula_notes: Record<string, string>
}

export interface ReadinessCheck {
  id: string
  label: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
  section: SectionId
  required: boolean
  ack_key?: keyof StrategyGovernance
  acknowledged?: boolean
}

export interface Readiness {
  score: number
  checks: ReadinessCheck[]
  blockers: ReadinessCheck[]
  warnings: ReadinessCheck[]
  can_publish: boolean
  required_total: number
  required_passed: number
}

export interface StrategyWarning {
  id: string
  severity: 'critical' | 'high' | 'caution' | 'info'
  title: string
  message: string
  ack_key: keyof StrategyGovernance | null
  section: SectionId
}

export interface Interaction {
  label: string
  severity: 'high' | 'moderate' | 'low'
  message: string
  recommendation: string
  medications: string[]
}

export interface FoodConflict {
  type: 'allergen' | 'diet'
  severity: string
  superfood: string
  message: string
}

export interface ClinicalFlag {
  code: string
  label: string
  severity: 'high' | 'review' | string
  message: string
  source: string
}

export interface MacroDayDerived extends MacroDay {
  day_short: string
  breakdown: MacroBreakdown
  protein_range: ProteinRange
  protein_per_kg: number
  protein_status: 'below' | 'within' | 'above' | 'unknown'
  complete: boolean
}

export interface Derived {
  age: number
  sex: string
  bmi: number
  bmi_category: string
  target_bmi: number
  target_bmi_category: string
  bmr: { value: number; source: string; label: string; fat_free_mass_kg?: number }
  tdee: number
  activity_factor: number
  rda: RdaRow | null
  ideal_weight: { value: number; method: string; detail: string }
  goal_mode: string
  weeks_to_target: number
  calories: {
    method: string
    calories: number
    goal_mode: string
    note: string
    basis: Record<string, number | string>
    floor?: number
    below_floor?: boolean
  }
  protein: ProteinRange
  week: MacroDayDerived[]
  totals: {
    avg_calories: number
    min_calories: number
    max_calories: number
    avg_protein: number
    avg_cho: number
    avg_fat: number
    days_complete: number
    within_protein: number
  }
  interactions: Interaction[]
  conflicts: FoodConflict[]
  flags: ClinicalFlag[]
  supplements: { cal: number; pro: number; fat: number; carb: number; fibre: number; share_of_calories: number }
  warnings: StrategyWarning[]
  readiness: Readiness
}

export interface StrategyDetail {
  strategy: StrategyRecord
  client: ClientSummary
  context: ClientContext
  derived: Derived
  readiness: Readiness
  reference: Reference
}
