export type DietType = 'vegetarian' | 'eggetarian' | 'non_vegetarian' | 'vegan' | 'jain'

export interface IntakePayload {
  name: string
  phone: string
  age: number
  gender: string
  city: string
  consent: boolean
  goals: string[]
  height_cm: number
  weight_kg: number
  target_weight_kg: number
  diet_type: DietType
  cuisine_preferences: string[]
  wake_time: string
  sleep_time: string
  work_schedule: string
  workout_level: string
  cravings: string[]
  water_intake: string
  eating_out_frequency: string
  cooking_help: string
  allergies_dislikes: string[]
  medical_risks: string[]
  active_medication: boolean
  abnormal_reports: boolean
  optional_note: string
}

export interface TriageResult {
  eligible_for_ai_plan: boolean
  risk_flags: string[]
  reason: string
  recommended_action: string
}

export interface FoodItem {
  food_id: string
  name: string
  portion: string
  calories: number
  preparation_note: string
}

export interface Meal {
  slot: string
  slot_key: string
  time: string
  items: FoodItem[]
  slot_calories: number
}

export interface PlanDay {
  day: string
  total_calories: number
  meals: Meal[]
}

export interface PlanResult {
  title: string
  subtitle: string
  duration_days: number
  profile_snapshot: Record<string, unknown>
  calorie_band: { min: number; max: number; label: string }
  days: PlanDay[]
  safety_note: string
  upgrade_options: Array<{ plan_type: 'ai_continuation' | 'human_dietician'; label: string; price: string }>
}

export interface RiskBrief {
  title: string
  summary: string
  cta: { label: string; price: string; plan_type: 'human_dietician' }
  profile: Record<string, unknown>
  routine: Record<string, unknown>
  food_context: Record<string, unknown>
  risk_flags: string[]
  dietician_questions: string[]
}

export interface LeadResponse {
  lead_id: string
  status: string
  triage: TriageResult
  result_type: 'plan' | 'brief'
  result: PlanResult | RiskBrief
}

export interface LeadListItem {
  id: string
  name: string
  phone: string
  city: string
  status: string
  triage_outcome: string
  created_at: string
  updated_at: string
  check_in_count: number
  upgrade_count: number
}

export interface LeadDetail {
  lead: LeadListItem
  intake: IntakePayload
  plan_record: {
    id: string
    lead_id: string
    plan_type: 'plan' | 'brief'
    content: PlanResult | RiskBrief
    created_at: string
  }
  check_ins: Array<{ id: string; day_number: number; payload: Record<string, unknown>; created_at: string }>
  upgrade_intents: Array<{ id: string; plan_type: string; contact_preference: string; message: string; created_at: string }>
  events: Array<{ id: string; event_type: string; payload: Record<string, unknown>; created_at: string }>
}

