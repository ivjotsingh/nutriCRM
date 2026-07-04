import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils
} from 'lucide-react'
import {
  getLead,
  listLeads,
  recordEvent,
  submitCheckIn,
  submitIntake,
  submitUpgradeIntent
} from './api'
import type { IntakePayload, LeadDetail, LeadListItem, LeadResponse, PlanDay, PlanResult, RiskBrief } from './types'

const goals = [
  ['weight_loss', 'Weight loss'],
  ['fat_loss', 'Fat loss'],
  ['body_toning', 'Body toning'],
  ['better_energy', 'Better energy'],
  ['muscle_gain', 'Muscle gain'],
  ['maintenance', 'Maintenance'],
  ['sports_performance', 'Sports performance'],
  ['digestion_bloating', 'Digestion / bloating']
]

const cuisines = ['North Indian', 'South Indian', 'Gujarati', 'Punjabi', 'Maharashtrian', 'Bengali', 'Mixed Indian']
const cravings = ['Sweet', 'Tea / coffee', 'Evening snacking', 'Late dinner', 'Fried food', 'Weekend overeating']
const allergies = ['Milk', 'Paneer', 'Curd', 'Egg', 'Gluten', 'Soy', 'Nuts', 'Banana', 'Brinjal', 'Garlic']
const medicalRisks = [
  ['diabetes', 'Diabetes'],
  ['kidney_disease', 'Kidney disease'],
  ['pregnancy_breastfeeding', 'Pregnancy / breastfeeding'],
  ['eating_disorder', 'Eating disorder history'],
  ['serious_cardiac', 'Serious cardiac issue'],
  ['liver_disease', 'Liver disease'],
  ['recent_surgery', 'Recent surgery'],
  ['severe_symptoms', 'Severe symptoms']
]

const timeOptions = ['05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM']

const displayLabels: Record<string, string> = {
  weight_loss: 'Weight loss',
  fat_loss: 'Fat loss',
  body_toning: 'Body toning',
  better_energy: 'Better energy',
  muscle_gain: 'Muscle gain',
  sports_performance: 'Sports performance',
  digestion_bloating: 'Digestion / bloating',
  non_vegetarian: 'Non-vegetarian',
  active_medication: 'Active medication',
  abnormal_reports: 'Abnormal reports',
  ai_plan_ready: 'AI plan ready',
  dietician_review_recommended: 'Dietician review recommended',
  upgrade_intent: 'Upgrade intent',
  human_dietician: 'Human dietician',
  ai_continuation: 'AI continuation',
  other_issue: 'Other issue'
}

const initialIntake: IntakePayload = {
  name: '',
  phone: '',
  age: 32,
  gender: 'Female',
  city: '',
  consent: false,
  goals: [],
  height_cm: 166,
  weight_kg: 78,
  target_weight_kg: 70,
  diet_type: 'vegetarian',
  cuisine_preferences: [],
  wake_time: '07:00 AM',
  sleep_time: '11:00 PM',
  work_schedule: 'Desk job',
  workout_level: '2-3 days / week',
  cravings: [],
  water_intake: '1-2 Litre',
  eating_out_frequency: '1-2 Times - Week',
  cooking_help: 'Yes - family support',
  allergies_dislikes: [],
  medical_risks: [],
  active_medication: false,
  abnormal_reports: false,
  optional_note: ''
}

const flowSteps = [
  { label: 'Identity', short: 'Start', icon: Phone },
  { label: 'Goal', short: 'Goal', icon: Target },
  { label: 'Routine', short: 'Routine', icon: Clock },
  { label: 'Food', short: 'Food', icon: ChefHat },
  { label: 'Health', short: 'Health', icon: HeartPulse }
]

function App() {
  const [route, setRoute] = useState(window.location.hash === '#admin' ? 'admin' : 'app')
  const [flowKey, setFlowKey] = useState(0)

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash === '#admin' ? 'admin' : 'app')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function goHome() {
    window.location.hash = ''
    setRoute('app')
    setFlowKey((current) => current + 1)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={goHome}>
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>NutriAlign</span>
        </button>
        <nav>
          <button className="icon-button" onClick={() => { window.location.hash = 'admin'; setRoute('admin') }} title="Admin dashboard">
            <LayoutDashboard size={18} />
            <span>Admin</span>
          </button>
        </nav>
      </header>
      {route === 'admin' ? <AdminDashboard /> : <UserFlow key={flowKey} />}
    </div>
  )
}

function UserFlow() {
  const [step, setStep] = useState(0)
  const [intake, setIntake] = useState<IntakePayload>(initialIntake)
  const [response, setResponse] = useState<LeadResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validation = validateStep(step, intake)
  const completion = useMemo(() => getCompletion(intake), [intake])
  const hasRiskSignal = intake.medical_risks.length > 0 || intake.active_medication || intake.abnormal_reports || intake.age < 18

  function update<K extends keyof IntakePayload>(key: K, value: IntakePayload[K]) {
    setIntake((current) => ({ ...current, [key]: value }))
  }

  function toggleList(key: 'goals' | 'cuisine_preferences' | 'cravings' | 'allergies_dislikes' | 'medical_risks', value: string) {
    setIntake((current) => {
      const existing = current[key]
      return {
        ...current,
        [key]: existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value]
      }
    })
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const result = await submitIntake(intake)
      localStorage.setItem('nutrialign:lastLeadId', result.lead_id)
      await recordEvent('intake_submitted', result.lead_id, { result_type: result.result_type })
      setResponse(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(buildFriendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <GeneratingView intake={intake} hasRiskSignal={hasRiskSignal} />
  }

  if (response) {
    if (response.result_type === 'plan') {
      return (
        <PlanViewer
          leadId={response.lead_id}
          plan={response.result as PlanResult}
          onRestart={() => {
            setResponse(null)
            setStep(0)
            setIntake(initialIntake)
          }}
        />
      )
    }
    return <RiskBriefView leadId={response.lead_id} brief={response.result as RiskBrief} />
  }

  return (
    <main className="intake-page">
      <section className="intake-workspace" id="intake-workspace">
        <aside className="journey-panel">
          <div className="journey-intro">
            <div className="eyebrow"><ShieldCheck size={16} /> Dietician-approved preview funnel</div>
            <h1>Get a free 7-day nutrition plan built from real dietician-style templates.</h1>
            <p>
              A guided intake turns your routine, food preferences, and eligibility into either a polished weekly plan or a
              dietician-ready nutrition brief.
            </p>
          </div>
          <div className="journey-score">
            <span>Intake readiness</span>
            <strong>{completion}%</strong>
            <div className="progress-track"><i style={{ width: `${completion}%` }} /></div>
          </div>
          <div className="journey-rail">
            {flowSteps.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  className={index === step ? 'rail-step active' : index < step ? 'rail-step done' : 'rail-step'}
                  onClick={() => index <= step && setStep(index)}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{stepDescription(index, intake)}</small>
                  </span>
                </button>
              )
            })}
          </div>
          <LiveBrief intake={intake} hasRiskSignal={hasRiskSignal} />
          <PlanTeaser />
        </aside>

        <section className="intake-panel">
          <div className="panel-kicker">Step {step + 1} of {flowSteps.length}</div>
          {step === 0 && (
            <QuestionBlock
              icon={<Phone size={24} />}
              title="Let’s personalize the preview."
              subtitle="Start with the minimum profile details needed for a safe preview."
            >
              <div className="field-grid">
                <TextField label="Name" value={intake.name} onChange={(value) => update('name', value)} />
                <TextField label="WhatsApp / phone" value={intake.phone} onChange={(value) => update('phone', value)} />
                <NumberStepper label="Age" value={intake.age} min={13} max={90} onChange={(value) => update('age', value)} />
                <TextField label="City" value={intake.city} onChange={(value) => update('city', value)} />
              </div>
              <ChoiceGroup
                label="Gender"
                options={['Female', 'Male', 'Other']}
                value={intake.gender}
                onChange={(value) => update('gender', value)}
              />
              <label className="consent-row">
                <input type="checkbox" checked={intake.consent} onChange={(event) => update('consent', event.target.checked)} />
                <span>I agree to share my health and lifestyle details for this nutrition preview and follow-up.</span>
              </label>
            </QuestionBlock>
          )}

          {step === 1 && (
            <QuestionBlock
              icon={<Target size={24} />}
              title="What should this plan optimize for?"
              subtitle="Goals, height, and weight define the preview target."
            >
              <ChipGrid label="Primary goals" options={goals} values={intake.goals} onToggle={(value) => toggleList('goals', value)} />
              <div className="field-grid three">
                <NumberStepper label="Height (cm)" value={intake.height_cm} min={120} max={230} onChange={(value) => update('height_cm', value)} />
                <NumberStepper label="Current weight (kg)" value={intake.weight_kg} min={35} max={220} onChange={(value) => update('weight_kg', value)} />
                <NumberStepper label="Target weight (kg)" value={intake.target_weight_kg} min={35} max={220} onChange={(value) => update('target_weight_kg', value)} />
              </div>
            </QuestionBlock>
          )}

          {step === 2 && (
            <QuestionBlock
              icon={<Clock size={24} />}
              title="Match the plan to your actual day."
              subtitle="Daily rhythm drives meal slots, portions, and prep realism."
            >
              <ChoiceGroup
                label="Diet type"
                options={['vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain']}
                value={intake.diet_type}
                onChange={(value) => update('diet_type', value as IntakePayload['diet_type'])}
                display={humanize}
              />
              <ChipGrid label="Cuisine preference" options={cuisines.map((item) => [item, item])} values={intake.cuisine_preferences} onToggle={(value) => toggleList('cuisine_preferences', value)} />
              <div className="field-grid three">
                <SelectField label="Wake time" value={intake.wake_time} options={timeOptions.slice(0, 6)} onChange={(value) => update('wake_time', value)} />
                <SelectField label="Sleep time" value={intake.sleep_time} options={timeOptions.slice(6)} onChange={(value) => update('sleep_time', value)} />
                <SelectField
                  label="Work schedule"
                  value={intake.work_schedule}
                  options={['Desk job', 'Hybrid work', 'On feet most day', 'Late shifts', 'Student schedule']}
                  onChange={(value) => update('work_schedule', value)}
                />
              </div>
              <div className="field-grid three">
                <SelectField
                  label="Workout level"
                  value={intake.workout_level}
                  options={['No workout', 'Walks only', '2-3 days / week', '5+ days / week', 'Athlete training']}
                  onChange={(value) => update('workout_level', value)}
                />
                <SelectField
                  label="Water intake"
                  value={intake.water_intake}
                  options={['Less than 1 Litre', '1-2 Litre', '2-3 Litre', '3+ Litre']}
                  onChange={(value) => update('water_intake', value)}
                />
                <SelectField
                  label="Eating out"
                  value={intake.eating_out_frequency}
                  options={['Rarely', '1-2 Times - Month', '1-2 Times - Week', '3+ Times - Week']}
                  onChange={(value) => update('eating_out_frequency', value)}
                />
              </div>
              <ChoiceGroup
                label="Cooking help"
                options={['Yes - family support', 'Yes - cook at home', 'No - self managed', 'Mostly ordering']}
                value={intake.cooking_help}
                onChange={(value) => update('cooking_help', value)}
              />
            </QuestionBlock>
          )}

          {step === 3 && (
            <QuestionBlock
              icon={<ChefHat size={24} />}
              title="Keep the food realistic."
              subtitle="Preference signals keep the plan practical and familiar."
            >
              <ChipGrid label="Cravings or friction points" options={cravings.map((item) => [item, item])} values={intake.cravings} onToggle={(value) => toggleList('cravings', value)} />
              <ChipGrid label="Allergies or dislikes" options={allergies.map((item) => [item, item])} values={intake.allergies_dislikes} onToggle={(value) => toggleList('allergies_dislikes', value)} />
              <TextAreaField label="Anything else" value={intake.optional_note} onChange={(value) => update('optional_note', value)} />
            </QuestionBlock>
          )}

          {step === 4 && (
            <QuestionBlock
              icon={<HeartPulse size={24} />}
              title="Final suitability check."
              subtitle="Health context decides whether this becomes a human review."
            >
              <ChipGrid
                label="Select any that apply"
                options={medicalRisks}
                values={intake.medical_risks}
                onToggle={(value) => toggleList('medical_risks', value)}
              />
              <div className="toggle-grid">
                <Toggle label="I am currently on medication" checked={intake.active_medication} onChange={(value) => update('active_medication', value)} />
                <Toggle label="I have abnormal reports needing review" checked={intake.abnormal_reports} onChange={(value) => update('abnormal_reports', value)} />
              </div>
              <button className="secondary-button subtle" onClick={() => setIntake((current) => ({ ...current, medical_risks: [], active_medication: false, abnormal_reports: false }))}>
                Clear health flags
              </button>
            </QuestionBlock>
          )}

          {error && (
            <div className="error-panel">
              <strong>Plan creation did not complete.</strong>
              <p>{error}</p>
            </div>
          )}

          <div className="flow-actions">
            <button className="secondary-button" disabled={step === 0 || loading} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Back
            </button>
            {step < flowSteps.length - 1 ? (
              <button className="primary-button" disabled={!validation.valid} onClick={() => setStep((current) => current + 1)}>
                Continue <ArrowRight size={18} />
              </button>
            ) : (
              <button className="primary-button create-button" disabled={loading} onClick={handleSubmit}>
                <Sparkles size={18} />
                {hasRiskSignal ? 'Prepare dietician brief' : 'Create my 7-day plan'}
              </button>
            )}
          </div>
          {!validation.valid && <p className="hint-text">{validation.message}</p>}
        </section>
      </section>

      <section className="credibility-strip">
        <Signal icon={<FileText size={18} />} label="Structured plan output" value="No freeform diet advice" />
        <Signal icon={<ShieldCheck size={18} />} label="Safety gate" value="Risk users go human" />
        <Signal icon={<ChefHat size={18} />} label="Food catalog" value="Approved meals only" />
        <Signal icon={<MessageCircle size={18} />} label="Conversion layer" value="WhatsApp-ready leads" />
      </section>
    </main>
  )
}

function PlanTeaser() {
  return (
    <div className="plan-teaser" aria-label="Diet plan preview">
      <div className="teaser-header">
        <span>Nutrition Plan (Weekly)</span>
        <strong>Preview</strong>
      </div>
      <div className="teaser-body">
        <div className="teaser-day">
          <span>Monday</span>
          <strong>1,148 cal</strong>
        </div>
        <div className="teaser-meals">
          <div><span>07:00</span><strong>Fenugreek water + soaked almonds</strong></div>
          <div><span>09:00</span><strong>Lemon upma + egg white</strong></div>
          <div><span>14:00</span><strong>Jowar roti + dal + sabji</strong></div>
          <div><span>20:00</span><strong>Salad + masoor dal with palak</strong></div>
        </div>
      </div>
      <div className="teaser-footer">
        <span>Validated foods only</span>
        <span>Dietician-style format</span>
      </div>
    </div>
  )
}

function Signal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="signal">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function LiveBrief({ intake, hasRiskSignal }: { intake: IntakePayload; hasRiskSignal: boolean }) {
  return (
    <div className="live-brief">
      <div>
        <span>Live brief</span>
        <strong>{intake.name || 'New lead'}</strong>
      </div>
      <dl>
        <div><dt>Goal</dt><dd>{humanize(intake.goals)}</dd></div>
        <div><dt>Diet</dt><dd>{humanize(intake.diet_type)}</dd></div>
        <div><dt>Routine</dt><dd>{intake.wake_time} wake, {intake.sleep_time} sleep</dd></div>
        <div><dt>Risk route</dt><dd>{hasRiskSignal ? 'Dietician review' : 'AI preview eligible'}</dd></div>
      </dl>
    </div>
  )
}

function QuestionBlock({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="question-block">
      <div className="section-title">
        <div className="section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="question-fields">{children}</div>
    </div>
  )
}

function GeneratingView({ intake, hasRiskSignal }: { intake: IntakePayload; hasRiskSignal: boolean }) {
  const checks = hasRiskSignal
    ? ['Saving your intake', 'Building dietician-ready brief', 'Highlighting risk flags', 'Preparing follow-up CTA']
    : ['Matching approved foods', 'Building 7-day rhythm', 'Checking dislikes and diet type', 'Validating calories and meal slots']

  return (
    <main className="generating-page">
      <div className="generation-panel">
        <div className="generation-loader"><Sparkles size={34} /></div>
        <div className="eyebrow">{hasRiskSignal ? 'Preparing expert handoff' : 'Creating plan'}</div>
        <h1>{hasRiskSignal ? 'Turning your intake into a dietician brief.' : 'Your 7-day nutrition plan is being assembled.'}</h1>
        <p>
          {intake.name ? `${intake.name}, ` : ''}we are using the approved food library and deterministic safety checks before showing the result.
        </p>
        <div className="generation-checks">
          {checks.map((check) => (
            <span key={check}><Check size={16} /> {check}</span>
          ))}
        </div>
      </div>
    </main>
  )
}

function validateStep(step: number, intake: IntakePayload): { valid: boolean; message: string } {
  if (step === 0) {
    if (!intake.name || !intake.phone || !intake.city || !intake.consent) return { valid: false, message: 'Name, WhatsApp, city, and consent are required.' }
  }
  if (step === 1) {
    if (!intake.goals.length) return { valid: false, message: 'Choose at least one goal.' }
    if (intake.target_weight_kg > intake.weight_kg + 20) return { valid: false, message: 'Target weight looks too far from current weight.' }
  }
  if (step === 2 && !intake.cuisine_preferences.length) return { valid: false, message: 'Choose at least one cuisine preference.' }
  return { valid: true, message: '' }
}

function getCompletion(intake: IntakePayload): number {
  const checks = [
    Boolean(intake.name),
    Boolean(intake.phone),
    Boolean(intake.city),
    intake.consent,
    intake.goals.length > 0,
    intake.height_cm > 0,
    intake.weight_kg > 0,
    intake.target_weight_kg > 0,
    Boolean(intake.diet_type),
    intake.cuisine_preferences.length > 0,
    Boolean(intake.wake_time),
    Boolean(intake.sleep_time),
    Boolean(intake.work_schedule),
    Boolean(intake.workout_level),
    Boolean(intake.water_intake),
    Boolean(intake.eating_out_frequency),
    Boolean(intake.cooking_help)
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function stepDescription(index: number, intake: IntakePayload): string {
  if (index === 0) return intake.name ? `${intake.name}, ${intake.city || 'city pending'}` : 'Name and WhatsApp'
  if (index === 1) return intake.goals.length ? humanize(intake.goals) : 'Goal and metrics'
  if (index === 2) return intake.cuisine_preferences.length ? humanize(intake.cuisine_preferences) : 'Routine and diet type'
  if (index === 3) return intake.allergies_dislikes.length ? `${intake.allergies_dislikes.length} exclusions` : 'Cravings and exclusions'
  return intake.medical_risks.length || intake.active_medication || intake.abnormal_reports ? 'Dietician route likely' : 'Eligibility check'
}

function buildFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Unable to submit intake'
  if (raw.includes('Failed to fetch')) {
    return 'The frontend could not reach the backend. Confirm FastAPI is running on http://127.0.0.1:8000 and try again.'
  }
  return raw
}

function humanize(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map(humanize).join(', ') : 'None'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value !== 'string') return value === undefined || value === null || value === '' ? 'None' : String(value)
  return displayLabels[value] ?? value.replaceAll('_', ' ')
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field full">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  )
}

function NumberStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="stepper-control">
        <button type="button" onClick={() => onChange(Math.max(min, Number(value) - 1))}>-</button>
        <input value={value} type="number" min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} />
        <button type="button" onClick={() => onChange(Math.min(max, Number(value) + 1))}>+</button>
      </div>
    </div>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function ChoiceGroup({ label, options, value, onChange, display }: { label: string; options: string[]; value: string; onChange: (value: string) => void; display?: (value: string) => string }) {
  return (
    <div className="choice-block">
      <span className="choice-label">{label}</span>
      <div className="choice-row">
        {options.map((option) => (
          <button key={option} className={option === value ? 'choice selected' : 'choice'} onClick={() => onChange(option)}>
            {display ? display(option) : option}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChipGrid({ label, options, values, onToggle }: { label: string; options: string[][]; values: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="choice-block">
      <span className="choice-label">{label}</span>
      <div className="chip-grid">
        {options.map(([value, labelText]) => (
          <button key={value} className={values.includes(value) ? 'chip selected' : 'chip'} onClick={() => onToggle(value)}>
            {values.includes(value) && <Check size={14} />}
            <span>{labelText}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={checked ? 'toggle selected' : 'toggle'} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <strong>{checked ? 'Yes' : 'No'}</strong>
    </button>
  )
}

function PlanViewer({ leadId, plan, onRestart }: { leadId: string; plan: PlanResult; onRestart: () => void }) {
  const [dayIndex, setDayIndex] = useState(0)
  const activeDay = plan.days[dayIndex]
  const shareText = encodeURIComponent(`My NutriAlign 7-day plan is ready. Lead: ${leadId}`)
  const avgCalories = Math.round(plan.days.reduce((sum, day) => sum + day.total_calories, 0) / plan.days.length)

  function handlePrint() {
    recordEvent('download_clicked', leadId)
    window.print()
  }

  return (
    <main className="result-page">
      <section className="plan-hero">
        <div className="plan-hero-copy">
          <div className="eyebrow"><Sparkles size={16} /> Plan ready</div>
          <h1>Your free 7-day nutrition preview is ready.</h1>
          <p>{plan.subtitle}</p>
          <div className="result-actions">
            <button className="secondary-button" onClick={handlePrint}><Download size={18} /> Download PDF</button>
            <a className="secondary-button" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer" onClick={() => recordEvent('whatsapp_clicked', leadId)}>
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
        </div>
        <div className="plan-scoreboard">
          <Metric icon={<CalendarDays size={18} />} label="Duration" value={`${plan.duration_days} days`} />
          <Metric icon={<Gauge size={18} />} label="Avg calories" value={`${avgCalories}/day`} />
          <Metric icon={<ChefHat size={18} />} label="Diet type" value={humanize(plan.profile_snapshot.diet_type)} />
          <Metric icon={<Target size={18} />} label="Goal" value={humanize(plan.profile_snapshot.goals)} />
        </div>
      </section>

      <section className="week-overview">
        {plan.days.map((day, index) => (
          <button key={day.day} className={index === dayIndex ? 'week-day active' : 'week-day'} onClick={() => setDayIndex(index)}>
            <span>{day.day}</span>
            <strong>{day.total_calories}</strong>
            <small>{day.meals.length} slots</small>
          </button>
        ))}
      </section>

      <section className="plan-studio">
        <DayTimeline day={activeDay} />
        <aside className="plan-aside">
          <div className="aside-panel">
            <h2>Why this feels dietician-made</h2>
            <ul>
              <li>Uses fixed meal slots and timings instead of a loose food list.</li>
              <li>Respects diet type and selected exclusions before rendering.</li>
              <li>Keeps calories inside the safe preview band.</li>
            </ul>
          </div>
          <div className="aside-panel muted-panel">
            <h2>Safety note</h2>
            <p>{plan.safety_note}</p>
          </div>
        </aside>
      </section>

      <CheckInForm leadId={leadId} />
      <UpgradePanel leadId={leadId} mode="normal" />
      <section className="restart-band">
        <button className="secondary-button" onClick={onRestart}>Create another plan</button>
      </section>
    </main>
  )
}

function DayTimeline({ day }: { day: PlanDay }) {
  return (
    <div className="day-timeline">
      <div className="day-header">
        <div>
          <span>Nutrition Plan (Weekly)</span>
          <h2>{day.day}</h2>
        </div>
        <strong>{day.total_calories} calories</strong>
      </div>
      <div className="meal-timeline">
        {day.meals.map((meal) => (
          <article className="meal-block" key={meal.slot_key}>
            <div className="meal-time">
              <strong>{meal.time}</strong>
              <span>{meal.slot}</span>
            </div>
            <div className="meal-items">
              {meal.items.map((item, index) => (
                <div className="meal-item" key={`${meal.slot_key}-${item.food_id}-${index}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.preparation_note || 'Approved catalog item.'}</p>
                  </div>
                  <span>{item.portion}</span>
                  <em>{item.calories} cal</em>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function RiskBriefView({ leadId, brief }: { leadId: string; brief: RiskBrief }) {
  return (
    <main className="result-page">
      <section className="risk-hero">
        <div>
          <div className="eyebrow"><ShieldCheck size={16} /> Expert review</div>
          <h1>We’re routing this to a dietician, not generating an AI diet.</h1>
          <p>{brief.summary}</p>
        </div>
        <UpgradePanel leadId={leadId} mode="risk" compact />
      </section>

      <section className="brief-board">
        <BriefSection title="Goals and profile" data={brief.profile} />
        <BriefSection title="Routine" data={brief.routine} />
        <BriefSection title="Food context" data={brief.food_context} />
        <div className="brief-panel risk-panel">
          <h2>Risk flags</h2>
          <div className="flag-list">
            {brief.risk_flags.map((flag) => <span key={flag}>{flag}</span>)}
          </div>
        </div>
      </section>

      <section className="handoff-panel">
        <div>
          <span>Prepared for the sales call</span>
          <h2>Dietician handoff questions</h2>
        </div>
        <ul>
          {brief.dietician_questions.map((question) => <li key={question}>{question}</li>)}
        </ul>
      </section>
    </main>
  )
}

function BriefSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="brief-panel">
      <h2>{title}</h2>
      <dl>
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll('_', ' ')}</dt>
            <dd>{humanize(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Metric({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CheckInForm({ leadId }: { leadId: string }) {
  const [dayNumber, setDayNumber] = useState(1)
  const [adherence, setAdherence] = useState('mostly')
  const [hunger, setHunger] = useState('okay')
  const [energy, setEnergy] = useState('good')
  const [digestion, setDigestion] = useState('okay')
  const [cravingsValue, setCravingsValue] = useState('manageable')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')

  async function handleSubmit() {
    await submitCheckIn(leadId, {
      day_number: dayNumber,
      adherence,
      hunger,
      energy,
      digestion,
      cravings: cravingsValue,
      notes
    })
    setStatus('Check-in saved. This lead now has adherence data.')
  }

  return (
    <section className="checkin-band">
      <QuestionBlock icon={<Activity size={22} />} title="Daily check-in" subtitle="Capture the behavior signal that makes the upgrade conversation specific.">
        <div className="checkin-grid">
          <NumberStepper label="Day" value={dayNumber} min={1} max={7} onChange={setDayNumber} />
          <SelectField label="Adherence" value={adherence} options={['low', 'partial', 'mostly', 'complete']} onChange={setAdherence} />
          <SelectField label="Hunger" value={hunger} options={['low', 'okay', 'high']} onChange={setHunger} />
          <SelectField label="Energy" value={energy} options={['low', 'okay', 'good']} onChange={setEnergy} />
          <SelectField label="Digestion" value={digestion} options={['okay', 'bloating', 'constipation', 'acidity', 'other_issue']} onChange={setDigestion} />
          <SelectField label="Cravings" value={cravingsValue} options={['none', 'manageable', 'strong']} onChange={setCravingsValue} />
        </div>
        <TextAreaField label="Notes" value={notes} onChange={setNotes} />
        <div className="flow-actions">
          <button className="primary-button" onClick={handleSubmit}><Check size={18} /> Save check-in</button>
          {status && <span className="success-text">{status}</span>}
        </div>
      </QuestionBlock>
    </section>
  )
}

function UpgradePanel({ leadId, mode, compact = false }: { leadId: string; mode: 'normal' | 'risk'; compact?: boolean }) {
  const [status, setStatus] = useState('')
  const options = mode === 'risk'
    ? [{ plan_type: 'human_dietician', label: 'Human dietician', price: 'Rs 18,000 / 3 months', copy: 'Expert review for health context, reports, medication, and safe personalization.' }]
    : [
        { plan_type: 'ai_continuation', label: 'AI continuation', price: 'Rs 9,000 / 3 months', copy: 'Weekly refreshes, reminders, swaps, and adherence-led adjustments for low-risk users.' },
        { plan_type: 'human_dietician', label: 'Human dietician', price: 'Rs 18,000 / 3 months', copy: 'Dietician judgment, review calls, medical/lab interpretation, and personal corrections.' }
      ]

  async function choose(planType: string) {
    await submitUpgradeIntent(leadId, {
      plan_type: planType,
      contact_preference: 'whatsapp',
      message: planType === 'human_dietician' ? 'Interested in dietician plan' : 'Interested in AI continuation'
    })
    setStatus('Intent captured. Team can follow up on WhatsApp.')
  }

  return (
    <section className={compact ? 'upgrade-panel compact' : 'upgrade-panel'}>
      {!compact && <QuestionBlock icon={<Utensils size={22} />} title="Continue beyond the free preview" subtitle="The plan proves quality; the upgrade unlocks continuity or human judgment."><span /></QuestionBlock>}
      <div className="upgrade-grid">
        {options.map((option) => (
          <div className="upgrade-card" key={option.plan_type}>
            <span>{option.label}</span>
            <strong>{option.price}</strong>
            <p>{option.copy}</p>
            <button className="primary-button" onClick={() => choose(option.plan_type)}>
              Select <ArrowRight size={18} />
            </button>
          </div>
        ))}
      </div>
      {status && <p className="success-text">{status}</p>}
    </section>
  )
}

function AdminDashboard() {
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<LeadDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listLeads()
      .then((data) => {
        setLeads(data.leads)
        if (data.leads[0]) setSelectedId(data.leads[0].id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load leads'))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    getLead(selectedId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load lead'))
  }, [selectedId])

  const stats = useMemo(() => {
    const risk = leads.filter((lead) => lead.triage_outcome === 'risk').length
    const upgrade = leads.filter((lead) => lead.upgrade_count > 0).length
    const checkedIn = leads.filter((lead) => lead.check_in_count > 0).length
    return { total: leads.length, risk, upgrade, checkedIn }
  }, [leads])

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="eyebrow"><LayoutDashboard size={16} /> Local operator view</div>
          <h1>Lead review dashboard</h1>
          <p>Inspect intake quality, risk routing, generated plans, check-ins, and conversion intent. This local admin has no production authentication.</p>
        </div>
        <div className="admin-stats">
          <Metric icon={<ClipboardList size={18} />} label="Leads" value={String(stats.total)} />
          <Metric icon={<ShieldCheck size={18} />} label="Risk routed" value={String(stats.risk)} />
          <Metric icon={<Activity size={18} />} label="Checked in" value={String(stats.checkedIn)} />
          <Metric icon={<ArrowRight size={18} />} label="Upgrade intent" value={String(stats.upgrade)} />
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      <section className="admin-grid">
        <div className="lead-list">
          <div className="list-heading">
            <h2>Leads</h2>
            <span>{leads.length} total</span>
          </div>
          {leads.length === 0 && <p className="empty-text">No leads yet.</p>}
          {leads.map((lead) => (
            <button key={lead.id} className={lead.id === selectedId ? 'lead-row active' : 'lead-row'} onClick={() => setSelectedId(lead.id)}>
              <span>
                <strong>{lead.name}</strong>
                <small>{lead.city} · {lead.phone}</small>
              </span>
              <em>{lead.triage_outcome}</em>
            </button>
          ))}
        </div>

        <div className="lead-detail">
          {!detail && <p className="empty-text">Select a lead.</p>}
          {detail && (
            <>
              <div className="detail-header">
                <div>
                  <span>{detail.plan_record.plan_type === 'plan' ? 'AI preview lead' : 'Dietician route lead'}</span>
                  <h2>{detail.lead.name}</h2>
                  <p>{humanize(detail.lead.status)}</p>
                </div>
                <strong>{detail.plan_record.plan_type}</strong>
              </div>
              <div className="detail-grid">
                <BriefSection title="Intake" data={{
                  goals: detail.intake.goals,
                  diet_type: detail.intake.diet_type,
                  cuisine: detail.intake.cuisine_preferences,
                  wake_time: detail.intake.wake_time,
                  sleep_time: detail.intake.sleep_time,
                  workout: detail.intake.workout_level,
                  risks: detail.intake.medical_risks.length ? detail.intake.medical_risks : 'none'
                }} />
                <BriefSection title="Lead status" data={{
                  check_ins: detail.check_ins.length,
                  upgrade_intents: detail.upgrade_intents.length,
                  created_at: new Date(detail.lead.created_at).toLocaleString()
                }} />
              </div>
              {detail.plan_record.plan_type === 'plan' ? (
                <div className="admin-plan-summary">
                  <h2>Generated plan</h2>
                  <div className="admin-week">
                    {(detail.plan_record.content as PlanResult).days.map((day) => (
                      <div className="admin-day" key={day.day}>
                        <strong>{day.day.slice(0, 3)}</strong>
                        <span>{day.total_calories} cal</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="admin-plan-summary">
                  <h2>Risk brief</h2>
                  <div className="flag-list">
                    {(detail.plan_record.content as RiskBrief).risk_flags.map((flag) => <span key={flag}>{flag}</span>)}
                  </div>
                </div>
              )}
              <div className="admin-plan-summary">
                <h2>Check-ins</h2>
                {detail.check_ins.length === 0 && <p className="empty-text">No check-ins yet.</p>}
                {detail.check_ins.map((checkIn) => (
                  <div className="admin-activity" key={checkIn.id}>
                    <strong>Day {checkIn.day_number}</strong>
                    <span>{humanize(checkIn.payload.adherence)} adherence · {humanize(checkIn.payload.energy)} energy</span>
                  </div>
                ))}
              </div>
              <div className="admin-plan-summary">
                <h2>Upgrade intent</h2>
                {detail.upgrade_intents.length === 0 && <p className="empty-text">No upgrade intent yet.</p>}
                {detail.upgrade_intents.map((intent) => (
                  <div className="admin-activity" key={intent.id}>
                    <strong>{humanize(intent.plan_type)}</strong>
                    <span>{intent.contact_preference}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
