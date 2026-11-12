import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Droplet,
  Flame,
  HeartPulse,
  Info,
  Plus,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Sparkles,
  Trash2,
  Utensils,
  Wand2
} from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  Derived,
  MacroDay,
  Reference,
  SectionId,
  StrategyData,
  StrategyDetail,
  StrategyWarning
} from './types'
import { CheckRow, MacroBar, Metric, ReadinessRow, SectionHeader, TagEditor } from './StrategyUI'
import { formatDateTime, formatShortDate, numberValue } from './utils'

export interface SectionProps {
  data: StrategyData
  detail: StrategyDetail
  reference: Reference
  derived: Derived
  locked: boolean
  update: (path: (string | number)[], value: unknown) => void
  onJump: (section: SectionId) => void
  onRefresh: (scope: 'clinical' | 'body' | 'support' | 'all') => Promise<void>
  refreshing: string
  onOpenFormula: () => void
  onOpenRda: () => void
  onOpenRecord: (tab: string) => void
  onEditDay: (day: MacroDay) => void
  onAddSuperfood: () => void
  onPublish: () => void
  onPreview: () => void
  onSave: () => void
  saving: boolean
  dirty: boolean
}

const THUMB_LABELS = [
  ['sedentary', 'Sedentary'],
  ['moderate', 'Moderate'],
  ['heavy', 'Heavy']
] as const

function Field({
  label,
  hint,
  children,
  span = 1
}: {
  label: string
  hint?: string
  children: ReactNode
  span?: 1 | 2 | 3
}) {
  return (
    <label className={`st-field span-${span}`}>
      <span className="st-label">{label}</span>
      {children}
      {hint && <small className="st-help">{hint}</small>}
    </label>
  )
}

function warningFor(derived: Derived, id: string): StrategyWarning | undefined {
  return derived.warnings.find((warning) => warning.id === id)
}

function AckWarning({
  warning,
  data,
  update,
  locked
}: {
  warning?: StrategyWarning
  data: StrategyData
  update: SectionProps['update']
  locked: boolean
}) {
  if (!warning || !warning.ack_key) return null
  const key = warning.ack_key
  return (
    <CheckRow
      checked={Boolean(data.governance[key])}
      onChange={(value) => update(['governance', key], value)}
      title="I reviewed this and accept clinical responsibility"
      description={warning.message}
      badge="Required to publish"
      disabled={locked}
    />
  )
}

/* ------------------------------------------------------------------ 01 brief */

export function BriefSection({ data, detail, reference, locked, update, onRefresh, refreshing }: SectionProps) {
  const meta = data.meta
  const stale = Boolean(data.clinical.client_updated_at && detail.client.updated_at !== data.clinical.client_updated_at)

  function regenerate() {
    const lines: string[] = []
    for (const condition of data.clinical.conditions.slice(0, 4)) lines.push(`${condition} management`)
    if (meta.major_goal && !['Weight maintenance', 'Medical condition management'].includes(meta.major_goal)) {
      lines.push(meta.major_goal)
    }
    for (const area of data.clinical.areas.slice(0, 2)) lines.push(area)
    update(['meta', 'description'], lines.map((line, index) => `${index + 1}. ${line}`).join('\n'))
  }

  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="01 · Brief"
        title="Name the strategy and set the delivery clock"
        lede="The parts a dietician decides: what this plan is for, who it is for, and when it reaches the client. Everything else is prefilled from the record."
        actions={
          <button
            type="button"
            className="secondary-button"
            onClick={() => void onRefresh('all')}
            disabled={locked || refreshing === 'all'}
          >
            <RefreshCw size={15} className={refreshing === 'all' ? 'spin' : ''} />
            Sync record
          </button>
        }
      />

      <div className="st-sync-note">
        <span className={stale ? 'st-sync-dot stale' : 'st-sync-dot'} aria-hidden="true" />
        <p>
          {stale
            ? 'The client record has changed since this draft was synced. Pull the latest clinical context.'
            : `Prefilled from ${detail.client.name}'s record · ${formatDateTime(data.clinical.synced_at)}`}
        </p>
        {stale && (
          <button type="button" className="st-link" onClick={() => void onRefresh('clinical')} disabled={locked}>
            Sync now
          </button>
        )}
      </div>

      <div className="st-grid st-grid-3">
        <Field label="Strategy name" span={3} hint="Appears in the client record and on the printed plan.">
          <input
            value={meta.name}
            onChange={(event) => update(['meta', 'name'], event.target.value)}
            placeholder="e.g. Weight management — Nov 2026"
            disabled={locked}
            maxLength={120}
          />
        </Field>
        <Field label="Type of diet">
          <select value={meta.diet_type} onChange={(event) => update(['meta', 'diet_type'], event.target.value)} disabled={locked}>
            {reference.diets.map((diet) => <option key={diet}>{diet}</option>)}
          </select>
        </Field>
        <Field label="Patient type">
          <select value={meta.patient_type} onChange={(event) => update(['meta', 'patient_type'], event.target.value)} disabled={locked}>
            {reference.patient_types.map((type) => <option key={type}>{type}</option>)}
          </select>
        </Field>
        <Field label="Program duration (days)" hint="Plan window in the header.">
          <input type="number" min={1} max={730} value={meta.duration_days || ''} onChange={(event) => update(['meta', 'duration_days'], numberValue(event.target.value))} disabled={locked} />
        </Field>
        <div className="st-goal-field">
          <Field label="Major goal">
            <select value={meta.major_goal} onChange={(event) => update(['meta', 'major_goal'], event.target.value)} disabled={locked}>
              {reference.major_goals.map((goal) => <option key={goal}>{goal}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="st-field">
        <span className="st-label">Clinical description</span>
        <textarea
          rows={6}
          value={meta.description}
          onChange={(event) => update(['meta', 'description'], event.target.value)}
          placeholder="1. Diabetes management&#10;2. Hypertension management"
          disabled={locked}
        />
        {!locked && (
          <button type="button" className="st-inline-action" onClick={regenerate}>
            <Wand2 size={14} /> Rewrite from record
          </button>
        )}
      </div>

      <div className="st-grid st-grid-3 st-subsection">
        <Field label="Blood report received" hint="Used to date the clinical snapshot.">
          <input
            type="datetime-local"
            value={meta.blood_report_at}
            onChange={(event) => update(['meta', 'blood_report_at'], event.target.value)}
            disabled={locked}
          />
        </Field>
        <Field label="Plan delivery to client" hint="Required before publishing.">
          <input
            type="datetime-local"
            value={meta.delivery_at}
            onChange={(event) => update(['meta', 'delivery_at'], event.target.value)}
            disabled={locked}
          />
        </Field>
        <Field label="Reason for delay" hint="Optional. Shown in the internal record.">
          <input
            value={meta.reason_for_delay}
            onChange={(event) => update(['meta', 'reason_for_delay'], event.target.value)}
            placeholder="e.g. awaiting repeat panel"
            disabled={locked}
          />
        </Field>
      </div>

      <div className="st-context-strip">
        <span><CalendarClock size={14} /> Program {detail.client.start_date ? formatShortDate(detail.client.start_date) : 'not set'} – {detail.client.end_date ? formatShortDate(detail.client.end_date) : 'open'}</span>
        <span><ShieldCheck size={14} /> {detail.client.consent ? 'Consent on file' : 'Consent missing'}</span>
        <span><HeartPulse size={14} /> {data.clinical.conditions.length} condition{data.clinical.conditions.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 02 clinical */

export function ClinicalSection({ data, detail, derived, locked, update, onRefresh, refreshing, onJump, onOpenRecord }: SectionProps) {
  const clinical = data.clinical
  const flags = derived.flags
  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="02 · Clinical context"
        title="The evidence behind the plan"
        lede="Pulled from the medical record, blood report, and head-to-toe screening. Edit here without changing the source record."
        actions={
          <button
            type="button"
            className="secondary-button"
            onClick={() => void onRefresh('clinical')}
            disabled={locked || refreshing === 'clinical'}
          >
            <RefreshCw size={15} className={refreshing === 'clinical' ? 'spin' : ''} /> Sync from record
          </button>
        }
      />

      <div className="st-clinical-meta">
        <span><Droplet size={13} /> Report {formatDateTime(data.meta.blood_report_at)}</span>
        <span><HeartPulse size={13} /> {data.clinical.conditions.length} conditions</span>
        <span><Activity size={13} /> {data.clinical.symptoms.length} symptoms</span>
        <span><ClipboardCheck size={13} /> {data.clinical.deranged.length} flagged parameters</span>
      </div>

      {flags.length > 0 && (
        <div className="st-flag-grid">
          {flags.slice(0, 4).map((flag) => (
            <div className={flag.severity === 'high' ? 'st-flag high' : 'st-flag'} key={flag.code}>
              <span className="st-flag-icon"><AlertTriangle size={15} /></span>
              <div>
                <strong>{flag.label}</strong>
                <p>{flag.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="st-grid st-grid-2">
        <TagEditor
          label="Goals of the client"
          values={clinical.goals}
          options={['Medical condition', 'Weight loss', 'Fat loss', 'Muscle gain', 'Better energy', 'Gut health', 'Sports performance']}
          onChange={(next) => update(['clinical', 'goals'], next)}
          locked={locked}
        />
        <TagEditor
          label="Areas to improve"
          values={clinical.areas}
          options={[
            'Improvement of gut health',
            'Improvement of diabetic management',
            'Improvement of hypertension',
            'Improvement of migraine issue',
            'Improvement of sleep quality',
            'Improvement of energy levels'
          ]}
          onChange={(next) => update(['clinical', 'areas'], next)}
          locked={locked}
        />
        <TagEditor
          label="Medical conditions"
          values={clinical.conditions}
          options={['Diabetes', 'Hypertension (High BP)', 'PCOS', 'Thyroid', 'Migraine', 'Acid reflux', 'Asthma', 'Osteoarthritis', 'Anaemia']}
          onChange={(next) => update(['clinical', 'conditions'], next)}
          locked={locked}
        />
        <TagEditor
          label="Medical symptoms"
          values={clinical.symptoms}
          options={['Migraine', 'Low immunity', 'Acid reflux', 'Low appetite', 'Knee pain', 'Fatigue', 'Bloating', 'Constipation']}
          onChange={(next) => update(['clinical', 'symptoms'], next)}
          locked={locked}
        />
      </div>

      <div className="st-table-block">
        <div className="st-block-head">
          <div>
            <h3>Deranged and borderline parameters</h3>
            <p>Flagged Low, High, or Critical in the blood report.</p>
          </div>
          <button type="button" className="st-link" onClick={() => onOpenRecord('blood')}>
            Open blood report <ArrowUpRight size={13} />
          </button>
        </div>
        {clinical.deranged.length === 0 ? (
          <div className="st-inline-empty">
            <ClipboardCheck size={18} />
            <p>No flagged parameters on this record. The plan can still be built from the clinical history.</p>
          </div>
        ) : (
          <div className="st-table-scroll" role="region" aria-label="Deranged blood parameters" tabIndex={0}>
            <table className="st-data-table">
              <caption className="st-visually-hidden">Deranged and borderline blood parameters</caption>
              <thead>
                <tr><th>Group</th><th>Test</th><th>Value</th><th>Reference</th><th>Flag</th></tr>
              </thead>
              <tbody>
                {clinical.deranged.map((row, index) => (
                  <tr key={`${row.test}-${index}`}>
                    <td>{row.group}</td>
                    <td><strong>{row.test}</strong></td>
                    <td className="st-num">{row.value} <small>{row.unit}</small></td>
                    <td className="st-muted">{row.range || '—'}</td>
                    <td><span className={`st-flag-pill ${row.flag.toLowerCase()}`}>{row.flag}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Field label="Clinical notes for this strategy" hint="Context the next dietician or reviewer should know.">
        <textarea
          rows={3}
          value={clinical.notes}
          onChange={(event) => update(['clinical', 'notes'], event.target.value)}
          placeholder="e.g. fasting glucose trending down; repeat HbA1c in 8 weeks"
          disabled={locked}
        />
      </Field>

      <div className="st-source-links">
        <button type="button" className="st-link" onClick={() => onOpenRecord('medical')}>
          <HeartPulse size={13} /> Medical & family history
        </button>
        <button type="button" className="st-link" onClick={() => onOpenRecord('blood')}>
          <Activity size={13} /> Blood report
        </button>
        <button type="button" className="st-link" onClick={() => onOpenRecord('headtoe')}>
          <ShieldCheck size={13} /> Head-to-toe
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 03 targets */

export function TargetsSection({ data, detail, reference, derived, locked, update, onOpenFormula }: SectionProps) {
  const body = data.body
  const lowCalorie = warningFor(derived, 'low_calorie')
  const targetBmi = warningFor(derived, 'target_bmi')
  const paediatric = warningFor(derived, 'paediatric_deficit')
  const pregnancy = warningFor(derived, 'pregnancy_calories')
  const ideal = derived.ideal_weight

  function pickIdeal() {
    if (!ideal.value) return
    update(['body', 'target_weight_kg'], ideal.value)
  }

  function setMethod(method: string) {
    update(['body', 'ideal_weight_method'], method)
    if (method === 'bmi22') {
      const metres = numberValue(body.height_cm) / 100
      if (metres) update(['body', 'ideal_weight_kg'], Math.round(22 * metres * metres * 10) / 10)
    }
    if (method === 'devine') {
      const inches = numberValue(body.height_cm) / 2.54
      const base = body.sex === 'Male' ? 50 : 45.5
      update(['body', 'ideal_weight_kg'], Math.round((base + Math.max(0, inches - 60) * 2.3) * 10) / 10)
    }
  }

  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="03 · Targets"
        title="Set the energy and protein guardrails"
        lede="Measurements and BMR are prefilled. Choose how calories are calculated; NutriAlign keeps the formula, floor, and protein guardrail visible."
        actions={
          <button type="button" className="secondary-button" onClick={onOpenFormula}>
            <Calculator size={15} /> How we calculate
          </button>
        }
      />

      <div className="st-metric-grid">
        <Metric label="Current BMI" value={derived.bmi || '—'} tone="ink" hint={derived.bmi_category} />
        <Metric label="BMR" value={derived.bmr.value ? Math.round(derived.bmr.value).toLocaleString() : '—'} unit=" kcal" tone="teal" hint={derived.bmr.label} />
        <Metric label="TDEE" value={derived.tdee ? Math.round(derived.tdee).toLocaleString() : '—'} unit=" kcal" tone="teal" hint={`× ${derived.activity_factor} activity`} />
        <Metric label="Target BMI" value={derived.target_bmi || '—'} tone={derived.target_bmi && derived.target_bmi < 18.5 ? 'coral' : 'amber'} hint={derived.target_bmi_category} />
        <Metric label="To target" value={derived.weeks_to_target || '—'} unit={derived.weeks_to_target ? ' weeks' : ''} tone="muted" hint="At a sustainable rate" />
      </div>

      <div className="st-card-block">
        <div className="st-block-head">
          <div><h3><Ruler size={16} /> Body and target</h3><p>Current values come from Body Assessment.</p></div>
          <button type="button" className="secondary-button compact" onClick={() => void onOpenFormula()}>
            <Info size={14} /> Ideal weight
          </button>
        </div>
        <div className="st-grid st-grid-4">
          <Field label="Height (cm)">
            <input type="number" min={100} max={230} step="0.1" value={body.height_cm || ''} onChange={(event) => update(['body', 'height_cm'], numberValue(event.target.value))} disabled={locked} />
          </Field>
          <Field label="Current weight (kg)">
            <input type="number" min={20} max={300} step="0.1" value={body.weight_kg || ''} onChange={(event) => update(['body', 'weight_kg'], numberValue(event.target.value))} disabled={locked} />
          </Field>
          <Field label="Body fat (%)" hint="Enables Katch-McArdle.">
            <input type="number" min={0} max={70} step="0.1" value={body.body_fat_pct || ''} onChange={(event) => update(['body', 'body_fat_pct'], numberValue(event.target.value))} disabled={locked} />
          </Field>
          <Field label="Target weight (kg)">
            <input type="number" min={20} max={300} step="0.1" value={body.target_weight_kg || ''} onChange={(event) => update(['body', 'target_weight_kg'], numberValue(event.target.value))} disabled={locked} />
          </Field>
          <Field label="Ideal weight method" span={2}>
            <select value={body.ideal_weight_method} onChange={(event) => setMethod(event.target.value)} disabled={locked}>
              {reference.ideal_weight_methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </Field>
          <Field label="Ideal weight (kg)" hint={ideal.detail}>
            <div className="st-input-with-action">
              <input
                type="number"
                step="0.1"
                value={body.ideal_weight_method === 'manual' ? body.ideal_weight_manual || '' : ideal.value || ''}
                onChange={(event) => update(['body', 'ideal_weight_manual'], numberValue(event.target.value))}
                disabled={locked || body.ideal_weight_method !== 'manual'}
              />
              <button type="button" className="st-mini-action" onClick={pickIdeal} disabled={locked || !ideal.value}>Use</button>
            </div>
          </Field>
          <Field label="Sex for equations">
            <select value={body.sex} onChange={(event) => update(['body', 'sex'], event.target.value)} disabled={locked}>
              <option>Female</option>
              <option>Male</option>
            </select>
          </Field>
          <Field label="Age" hint="From date of birth.">
            <input type="number" min={0} max={120} value={body.age || ''} onChange={(event) => update(['body', 'age'], numberValue(event.target.value))} disabled={locked} />
          </Field>
          <Field label="Life stage">
            <select value={body.life_stage} onChange={(event) => update(['body', 'life_stage'], event.target.value)} disabled={locked}>
              {reference.life_stages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </Field>
          <Field label="Activity level">
            <select value={body.activity_level} onChange={(event) => update(['body', 'activity_level'], event.target.value)} disabled={locked}>
              {reference.activity_levels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
            </select>
          </Field>
          <Field label="Goal mode">
            <select value={body.goal_mode} onChange={(event) => update(['body', 'goal_mode'], event.target.value)} disabled={locked}>
              {reference.goal_modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="st-card-block">
        <div className="st-block-head">
          <div><h3><Flame size={16} /> Calorie formula</h3><p>One method drives the suggested week. Every day can still be overridden.</p></div>
        </div>
        <div className="st-formula-grid" role="radiogroup" aria-label="Calorie formula">
          {[
            { value: 'thumb', title: 'Thumb rule', detail: 'Target weight × activity factor', icon: Flame },
            { value: 'bmr', title: 'BMR + activity', detail: 'Katch or Mifflin, then goal adjustment', icon: Activity },
            { value: 'rda', title: 'RDA chart', detail: 'ICMR-NIN 2020 energy for age and sex', icon: ClipboardCheck }
          ].map((option) => {
            const Icon = option.icon
            const selected = body.calorie_method === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'st-formula-card selected' : 'st-formula-card'}
                onClick={() => update(['body', 'calorie_method'], option.value)}
                disabled={locked}
              >
                <Icon size={18} />
                <span><strong>{option.title}</strong><small>{option.detail}</small></span>
                {selected && <CheckCircle2 size={17} className="st-formula-check" />}
              </button>
            )
          })}
        </div>
        <div className="st-grid st-grid-3">
          <Field label="Workout allowance (kcal)" hint="Added to the thumb rule only.">
            <input type="number" min={0} max={1500} step="10" placeholder="0" value={body.workout_extra_kcal || ''} onChange={(event) => update(['body', 'workout_extra_kcal'], numberValue(event.target.value))} disabled={locked} />
          </Field>
          <Field label="Protein target (g/kg)" hint="Applied to target weight.">
            <select value={body.protein_target} onChange={(event) => update(['body', 'protein_target'], event.target.value)} disabled={locked}>
              {reference.protein_targets.map((range) => <option key={range}>{range}</option>)}
            </select>
          </Field>
          <div className="st-calorie-result">
            <span>Calorie requirement</span>
            <strong>{derived.calories.calories ? derived.calories.calories.toLocaleString() : '—'}<em> kcal</em></strong>
            <small>{derived.calories.note}</small>
          </div>
        </div>
        <div className="st-protein-line">
          <span className="st-protein-pill">Protein {derived.protein.range} g/kg</span>
          <span>{derived.protein.min_g}–{derived.protein.max_g} g per day</span>
          <span className="st-protein-note">Target {body.target_weight_kg || '—'} kg · {derived.week[0]?.protein_per_kg ?? '—'} g/kg planned</span>
        </div>
      </div>

      {(lowCalorie || targetBmi || paediatric || pregnancy) && (
        <div className="st-warning-stack">
          {lowCalorie && (
            <div className="st-warning critical">
              <div><AlertTriangle size={16} /><strong>{lowCalorie.title}</strong><p>{lowCalorie.message}</p></div>
              <AckWarning warning={lowCalorie} data={data} update={update} locked={locked} />
            </div>
          )}
          {targetBmi && (
            <div className="st-warning critical">
              <div><AlertTriangle size={16} /><strong>{targetBmi.title}</strong><p>{targetBmi.message}</p></div>
              <AckWarning warning={targetBmi} data={data} update={update} locked={locked} />
            </div>
          )}
          {paediatric && (
            <div className="st-warning high">
              <div><AlertTriangle size={16} /><strong>{paediatric.title}</strong><p>{paediatric.message}</p></div>
              <AckWarning warning={paediatric} data={data} update={update} locked={locked} />
            </div>
          )}
          {pregnancy && (
            <div className="st-warning critical">
              <div><AlertTriangle size={16} /><strong>{pregnancy.title}</strong><p>{pregnancy.message}</p></div>
              <AckWarning warning={pregnancy} data={data} update={update} locked={locked} />
            </div>
          )}
        </div>
      )}

      <div className="st-thumb-table">
        <div className="st-block-head"><div><h3>Thumb rule reference</h3><p>kcal per kg of target body weight.</p></div></div>
        <div className="st-thumb-grid">
          <span />
          {THUMB_LABELS.map(([, label]) => <strong key={label}>{label}</strong>)}
          {(['loss', 'maintenance', 'gain'] as const).map((mode) => (
            <div className="st-thumb-row" key={mode}>
              <strong>{mode === 'loss' ? 'Weight loss' : mode === 'gain' ? 'Weight gain' : 'Maintenance'}</strong>
              {THUMB_LABELS.map(([key]) => {
                const value = reference.thumb_factors[mode]?.[key] ?? 0
                const active = derived.goal_mode === mode && reference.activity_levels.find((level) => level.value === body.activity_level)?.thumb === key
                return <span className={active ? 'active' : ''} key={key}>{value}</span>
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 04 macros */

function statusLabel(status?: string) {
  if (status === 'within') return 'On target'
  if (status === 'below') return 'Below target'
  if (status === 'above') return 'Above target'
  return 'Needs values'
}

export function MacrosSection({
  data,
  derived,
  locked,
  update,
  onEditDay,
  onOpenRda,
  onOpenFormula
}: SectionProps & { onEditDay: (day: MacroDay) => void }) {
  const days = derived.week
  const deviation = warningFor(derived, 'protein_deviation')
  const variance = warningFor(derived, 'week_variance')
  const targetMismatch = derived.calories.calories > 0 && Math.abs(derived.calories.calories - derived.totals.avg_calories) > 1

  function rebuild() {
    const base = derived.week[0]
    if (!base) return
    const next = data.macros.days.map((day) => ({
      ...day,
      formula: data.body.calorie_method,
      calories: derived.calories.calories,
      protein_target: data.body.protein_target,
      ratio: base.ratio,
      note: derived.calories.note
    }))
    update(['macros', 'days'], next)
  }

  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="04 · Macro week"
        title="Make the seven days add up"
        lede="A suggested week is already calculated. Open any day to adjust calories, protein target, or the CHO / protein / fat split. Grams update from the ratio."
        actions={
          <>
            <button type="button" className="secondary-button" onClick={onOpenRda}><ClipboardCheck size={15} /> RDA data</button>
            <button type="button" className="secondary-button" onClick={rebuild} disabled={locked || !derived.calories.calories}>
              <RefreshCw size={15} /> Rebuild week
            </button>
          </>
        }
      />

      <div className="st-week-summary">
        <div><span>Average</span><strong>{derived.totals.avg_calories.toLocaleString()}<em> kcal</em></strong></div>
        <div><span>Protein</span><strong>{derived.totals.avg_protein}<em> g</em></strong></div>
        <div><span>Carbs</span><strong>{derived.totals.avg_cho}<em> g</em></strong></div>
        <div><span>Fat</span><strong>{derived.totals.avg_fat}<em> g</em></strong></div>
        <div><span>Week</span><strong>{derived.totals.days_complete}<em> / 7 days</em></strong></div>
        <div className="st-week-protein"><span>Protein in range</span><strong>{derived.totals.within_protein}<em> / 7</em></strong></div>
      </div>

      {targetMismatch && (
        <div className="st-warning info">
          <div>
            <Info size={16} />
            <strong>Targets changed to {derived.calories.calories.toLocaleString()} kcal</strong>
            <p>The week still averages {derived.totals.avg_calories.toLocaleString()} kcal. Rebuild the week to apply the new target, or keep the current day-by-day plan.</p>
          </div>
          <button type="button" className="secondary-button compact" onClick={rebuild} disabled={locked}>
            <RefreshCw size={14} /> Rebuild week
          </button>
        </div>
      )}

      <div className="st-macro-template">
        <span><Sparkles size={14} /> Suggested from {derived.calories.calories ? `${derived.calories.calories.toLocaleString()} kcal` : 'your targets'}</span>
        <span>{days[0]?.ratio.cho ?? '—'} / {days[0]?.ratio.pro ?? '—'} / {days[0]?.ratio.fat ?? '—'} CHO · Pro · Fat</span>
        <button type="button" className="st-link" onClick={onOpenFormula}>Formula</button>
      </div>

      <div className="st-table-scroll st-macro-wrap" role="region" aria-label="Seven day macro plan" tabIndex={0}>
        <table className="st-macro-table">
          <caption className="st-visually-hidden">Seven day macro plan</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Calories</th>
              <th>Protein</th>
              <th>Ratio</th>
              <th>Distribution (kcal · g)</th>
              <th><span className="st-visually-hidden">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day} className={!day.complete ? 'incomplete' : undefined}>
                <td className="st-day-cell">
                  <strong>{day.day}</strong>
                  <span className="st-day-sub">
                    <span className="st-formula-pill">{day.formula === 'thumb' ? 'Thumb' : day.formula === 'bmr' ? 'BMR' : 'RDA'}</span>
                    <small>{day.day_short}</small>
                  </span>
                </td>
                <td className="st-num">{day.calories ? day.calories.toLocaleString() : '—'}</td>
                <td>
                  <div className="st-protein-cell">
                    <span className="st-protein-target">{day.protein_target.replace('-', '–')} g/kg</span>
                    <span className={`st-protein-status ${day.protein_status}`}>
                      {day.breakdown.grams.pro} g <small>{day.protein_per_kg} g/kg</small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className="st-ratio-mini">{day.ratio.cho}<i>/</i>{day.ratio.pro}<i>/</i>{day.ratio.fat}</span>
                </td>
                <td>
                  <div className="st-distribution">
                    <MacroBar cho={day.breakdown.kcal.cho} pro={day.breakdown.kcal.pro} fat={day.breakdown.kcal.fat} compact />
                    <small className="st-dist-kcal">{Math.round(day.breakdown.kcal.cho)} · {Math.round(day.breakdown.kcal.pro)} · {Math.round(day.breakdown.kcal.fat)} kcal</small>
                    <small>{day.breakdown.grams.cho} · {day.breakdown.grams.pro} · {day.breakdown.grams.fat} g</small>
                  </div>
                </td>
                <td>
                  <button type="button" className="st-row-edit" onClick={() => onEditDay(day)} disabled={locked} aria-label={`Edit ${day.day} macros`}>
                    <ChevronRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="st-macro-cards">
        {days.map((day) => (
          <button type="button" key={day.day} className="st-macro-card" onClick={() => onEditDay(day)} disabled={locked}>
            <div className="st-macro-card-head">
              <strong>{day.day}</strong>
              <span className={`st-protein-status ${day.protein_status}`}>{statusLabel(day.protein_status)}</span>
            </div>
            <div className="st-macro-card-main">
              <span className="st-num">{day.calories ? day.calories.toLocaleString() : '—'}<small> kcal</small></span>
              <span>{day.ratio.cho}/{day.ratio.pro}/{day.ratio.fat}</span>
            </div>
            <MacroBar cho={day.breakdown.kcal.cho} pro={day.breakdown.kcal.pro} fat={day.breakdown.kcal.fat} compact />
            <div className="st-macro-card-foot">
              <span>P {day.breakdown.grams.pro} g</span>
              <span>C {day.breakdown.grams.cho} g</span>
              <span>F {day.breakdown.grams.fat} g</span>
              <ChevronRight size={14} />
            </div>
          </button>
        ))}
      </div>

      {deviation && (
        <div className="st-warning caution">
          <div><AlertTriangle size={16} /><strong>{deviation.title}</strong><p>{deviation.message}</p></div>
          <AckWarning warning={deviation} data={data} update={update} locked={locked} />
        </div>
      )}
      {variance && (
        <div className="st-warning info">
          <div><Info size={16} /><strong>{variance.title}</strong><p>{variance.message}</p></div>
        </div>
      )}

      <div className="st-macro-note">
        <Info size={14} />
        <p>
          Grams are floored to whole numbers after calories are allocated ({' '}
          carbs and protein ÷ 4, fat ÷ 9). Protein is checked per kg of target weight. Open a day to override it
          without changing the whole week.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 05 food */

export function FoodSection({ data, detail, reference, derived, locked, update, onAddSuperfood, onJump }: SectionProps) {
  const conflicts = derived.conflicts
  const conflictWarning = warningFor(derived, 'food_conflicts')
  const context = detail.context

  function removeSuperfood(name: string) {
    update(['food', 'superfoods'], data.food.superfoods.filter((item) => item.name !== name))
  }

  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="05 · Food strategy"
        title="Set the food direction before recipes exist"
        lede="The patterns, goals, and superfoods that shape the meals. Allergies, intolerances, and diet are checked against every selection."
      />

      <div className="st-guardrail-card">
        <div className="st-guardrail-head">
          <span className="st-guardrail-icon"><ShieldCheck size={17} /></span>
          <div><strong>Guardrails from the record</strong><small>Applied automatically to this strategy.</small></div>
        </div>
        <div className="st-guardrail-tags">
          <span className="st-guardrail-tag">{context.diet || data.meta.diet_type}</span>
          {context.allergies.map((item) => <span className="st-guardrail-tag danger" key={`a-${item}`}>{item}</span>)}
          {context.intolerances.map((item) => <span className="st-guardrail-tag warn" key={`i-${item}`}>{item}</span>)}
          {context.restrictions.map((item) => <span className="st-guardrail-tag" key={`r-${item}`}>{item}</span>)}
          {!context.allergies.length && !context.intolerances.length && !context.restrictions.length && (
            <span className="st-guardrail-empty">No allergies or restrictions recorded.</span>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="st-warning critical">
          <div>
            <AlertTriangle size={16} />
            <strong>Food guardrail conflict</strong>
            <ul className="st-warning-list">
              {conflicts.map((conflict, index) => <li key={`${conflict.superfood}-${index}`}>{conflict.message}</li>)}
            </ul>
          </div>
          {conflictWarning && <AckWarning warning={conflictWarning} data={data} update={update} locked={locked} />}
        </div>
      )}

      <div className="st-grid st-grid-1">
        <TagEditor
          label="Food-wise strategy"
          values={data.food.food_wise}
          options={reference.food_strategy_options}
          onChange={(next) => update(['food', 'food_wise'], next)}
          help="Cooking style, texture, and meal pattern."
          locked={locked}
        />
        <TagEditor
          label="Other goals"
          values={data.food.other_goals}
          options={reference.other_goal_options}
          onChange={(next) => update(['food', 'other_goals'], next)}
          help="Outcomes the food pattern should support."
          locked={locked}
          tone="amber"
        />
        <TagEditor
          label="Strategy for the next phase"
          values={data.food.next_phase}
          options={reference.next_phase_options}
          onChange={(next) => update(['food', 'next_phase'], next)}
          help="What the next plan should move towards."
          locked={locked}
        />
      </div>

      <div className="st-table-block">
        <div className="st-block-head">
          <div><h3><Sparkles size={16} /> Superfoods</h3><p>Practice favourites with a reason, not a bare list.</p></div>
          <button type="button" className="secondary-button" onClick={onAddSuperfood} disabled={locked}><Plus size={15} /> Add superfood</button>
        </div>
        {data.food.superfoods.length === 0 ? (
          <div className="st-inline-empty">
            <Utensils size={18} />
            <p>No superfoods selected yet. Add two or three that fit the diet and the clinical picture.</p>
          </div>
        ) : (
          <>
          <p className="st-table-hint">Scroll sideways to see every recommendation.</p>
          <div className="st-table-scroll" role="region" aria-label="Superfoods" tabIndex={0}>
            <table className="st-data-table st-superfood-table">
              <caption className="st-visually-hidden">Superfoods</caption>
              <thead><tr><th>Superfood</th><th>Category</th><th>Panel</th><th>Points</th><th>Source</th><th>Recommendation</th><th><span className="st-visually-hidden">Remove</span></th></tr></thead>
              <tbody>
                {data.food.superfoods.map((row) => {
                  const conflict = conflicts.some((item) => item.superfood === row.name)
                  return (
                    <tr key={row.name} className={conflict ? 'conflict' : undefined}>
                      <td><strong>{row.name}</strong>{conflict && <span className="st-conflict-dot" title="Guardrail conflict">!</span>}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.panel || '—'}</td>
                      <td>{row.points || '—'}</td>
                      <td><span className="st-source-pill">{row.source || 'Manual'}</span></td>
                      <td className="st-recommendation">{row.recommendation || '—'}</td>
                      <td>
                        <button type="button" className="st-icon-danger" onClick={() => removeSuperfood(row.name)} disabled={locked} aria-label={`Remove ${row.name}`}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className="st-tip">
        <Info size={15} />
        <p>Superfoods are a supporting pattern, not a treatment. Use the recommendation field to explain why each one is on the plan.</p>
        <button type="button" className="st-link" onClick={() => onJump('clinical')}>Review clinical context</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 06 support */

export function SupportSection({ data, detail, reference, derived, locked, update, onRefresh, refreshing }: SectionProps) {
  const interactions = derived.interactions
  const supplements = data.supplements
  const medications = data.medications.current
  const interactionWarning = warningFor(derived, 'interactions')
  const [libraryPick, setLibraryPick] = useState('')

  const localTotals = supplements.reduce(
    (acc, row) => {
      const qty = numberValue(row.quantity, 1)
      acc.cal += numberValue(row.cal) * qty
      acc.pro += numberValue(row.pro) * qty
      acc.fat += numberValue(row.fat) * qty
      acc.carb += numberValue(row.carb) * qty
      acc.fibre += numberValue(row.fibre) * qty
      return acc
    },
    { cal: 0, pro: 0, fat: 0, carb: 0, fibre: 0 }
  )

  function addFromLibrary(name: string) {
    const item = reference.supplements.find((entry) => entry.name === name)
    if (!item) return
    update(['supplements'], [
      ...supplements,
      { name: item.name, quantity: item.quantity, unit: item.unit, cal: item.cal, pro: item.pro, fat: item.fat, carb: item.carb, fibre: item.fibre, source: 'Practice library' }
    ])
    setLibraryPick('')
  }

  function addBlankSupplement() {
    update(['supplements'], [...supplements, { name: '', quantity: 1, unit: 'Serving', cal: 0, pro: 0, fat: 0, carb: 0, fibre: 0, source: 'Manual' }])
  }

  function updateSupplement(index: number, key: string, value: unknown) {
    update(['supplements'], supplements.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  function removeSupplement(index: number) {
    update(['supplements'], supplements.filter((_, rowIndex) => rowIndex !== index))
  }

  function addMedication() {
    update(['medications', 'current'], [
      ...medications,
      { type: 'Medication', name: '', brand: '', time: '', quantity: 1, dosage_per: 'Day', composition: '', taking_since: '', changes: '' }
    ])
  }

  function updateMedication(index: number, key: string, value: unknown) {
    update(['medications', 'current'], medications.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  function removeMedication(index: number) {
    update(['medications', 'current'], medications.filter((_, rowIndex) => rowIndex !== index))
  }

  const medNames = new Set(interactions.flatMap((item) => item.medications.map((name) => name.toLowerCase())))

  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="06 · Supplements & medications"
        title="Close the pharmacology gap"
        lede="Supplements and medicines are prefilled from the record. NutriAlign checks common nutrient interactions before the plan can be signed."
        actions={
          <button type="button" className="secondary-button" onClick={() => void onRefresh('support')} disabled={locked || refreshing === 'support'}>
            <RefreshCw size={15} className={refreshing === 'support' ? 'spin' : ''} /> Pull from record
          </button>
        }
      />

      <div className="st-table-block">
        <div className="st-block-head">
          <div><h3><HeartPulse size={16} /> Medication interactions</h3><p>{interactions.length ? `${interactions.length} review item${interactions.length === 1 ? '' : 's'} detected.` : 'No common interaction rule matched the current list.'}</p></div>
          <span className={interactions.some((item) => item.severity === 'high') ? 'st-badge danger' : interactions.length ? 'st-badge warn' : 'st-badge ok'}>
            {interactions.some((item) => item.severity === 'high') ? 'High risk' : interactions.length ? 'Review' : 'Clear'}
          </span>
        </div>
        {interactions.length === 0 ? (
          <div className="st-inline-empty"><ShieldCheck size={18} /><p>No interaction rule matched. Still confirm the medication list is current.</p></div>
        ) : (
          <div className="st-interaction-list">
            {interactions.map((item) => (
              <article className={`st-interaction ${item.severity}`} key={item.label}>
                <div className="st-interaction-head">
                  <span className={`st-severity ${item.severity}`}>{item.severity}</span>
                  <strong>{item.label}</strong>
                  <span className="st-interaction-meds">{item.medications.join(', ')}</span>
                </div>
                <p>{item.message}</p>
                <small><strong>Action:</strong> {item.recommendation}</small>
              </article>
            ))}
            {interactionWarning && <AckWarning warning={interactionWarning} data={data} update={update} locked={locked} />}
          </div>
        )}
      </div>

      <div className="st-table-block">
        <div className="st-block-head">
          <div><h3><Sparkles size={16} /> Supplements</h3><p>Calories and macros count towards the day.</p></div>
          <div className="st-add-group">
            <select
              value={libraryPick}
              onChange={(event) => addFromLibrary(event.target.value)}
              disabled={locked}
              aria-label="Add supplement from library"
            >
              <option value="">Add from library…</option>
              {reference.supplements.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <button type="button" className="secondary-button" onClick={addBlankSupplement} disabled={locked}><Plus size={15} /> Custom</button>
          </div>
        </div>
        {supplements.length === 0 ? (
          <div className="st-inline-empty"><Sparkles size={18} /><p>No supplements yet. Add only what the client is actually taking or you are prescribing.</p></div>
        ) : (
          <>
          <p className="st-table-hint">Scroll sideways to see all supplement columns.</p>
          <div className="st-table-scroll" role="region" aria-label="Supplements" tabIndex={0}>
            <table className="st-data-table st-edit-table">
              <caption className="st-visually-hidden">Supplements</caption>
              <thead><tr><th>Supplement</th><th>Qty</th><th>Unit</th><th>Cal</th><th>Pro</th><th>Fat</th><th>Carb</th><th>Fibre</th><th><span className="st-visually-hidden">Remove</span></th></tr></thead>
              <tbody>
                {supplements.map((row, index) => (
                  <tr key={`${row.name}-${index}`}>
                    <td><input value={row.name} onChange={(event) => updateSupplement(index, 'name', event.target.value)} placeholder="Supplement name" aria-label={`Supplement ${index + 1} name`} disabled={locked} /></td>
                    <td><input className="st-input-xs" type="number" min={0} step="0.5" value={row.quantity} onChange={(event) => updateSupplement(index, 'quantity', numberValue(event.target.value))} aria-label={`Supplement ${index + 1} quantity`} disabled={locked} /></td>
                    <td><input className="st-input-sm" value={row.unit} onChange={(event) => updateSupplement(index, 'unit', event.target.value)} aria-label={`Supplement ${index + 1} unit`} disabled={locked} /></td>
                    {(['cal', 'pro', 'fat', 'carb', 'fibre'] as const).map((key) => (
                      <td key={key}><input className="st-input-xs" type="number" min={0} step="0.1" value={row[key]} onChange={(event) => updateSupplement(index, key, numberValue(event.target.value))} aria-label={`Supplement ${index + 1} ${key}`} disabled={locked} /></td>
                    ))}
                    <td><button type="button" className="st-icon-danger" onClick={() => removeSupplement(index)} disabled={locked} aria-label={`Remove supplement ${index + 1}`}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>Total</strong></td>
                  <td>{localTotals.cal.toFixed(1)}</td>
                  <td>{localTotals.pro.toFixed(1)}</td>
                  <td>{localTotals.fat.toFixed(1)}</td>
                  <td>{localTotals.carb.toFixed(1)}</td>
                  <td>{localTotals.fibre.toFixed(1)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
        {supplements.length > 0 && derived.calories.calories > 0 && (
          <p className="st-table-footnote">
            Supplements supply {Math.round(localTotals.cal)} kcal, {Math.round((localTotals.cal / derived.calories.calories) * 100)}% of the daily target.
          </p>
        )}
      </div>

      <div className="st-table-block">
        <div className="st-block-head">
          <div><h3><ClipboardCheck size={16} /> Already taking supplements / medications</h3><p>Name, dose, timing, and since-date drive the interaction check.</p></div>
          <button type="button" className="secondary-button" onClick={addMedication} disabled={locked}><Plus size={15} /> Add medication</button>
        </div>
        {medications.length === 0 ? (
          <div className="st-inline-empty"><ClipboardCheck size={18} /><p>No medications on the record. Add any prescription, OTC medicine, or supplement in use.</p></div>
        ) : (
          <>
          <p className="st-table-hint">Scroll sideways to see timing and since-date.</p>
          <div className="st-table-scroll" role="region" aria-label="Medications" tabIndex={0}>
            <table className="st-data-table st-edit-table st-med-table">
              <caption className="st-visually-hidden">Medications</caption>
              <thead><tr><th>Medication</th><th>Qty / frequency</th><th>Timing</th><th>Taking since</th><th><span className="st-visually-hidden">Remove</span></th></tr></thead>
              <tbody>
                {medications.map((row, index) => {
                  const flagged = medNames.has(row.name.toLowerCase()) || [...medNames].some((name) => row.name.toLowerCase().includes(name))
                  return (
                    <tr key={index} className={flagged ? 'flagged' : undefined}>
                      <td>
                        <div className="st-med-main">
                        <div className="st-med-type-row">
                          <select className="st-type-select" value={row.type} onChange={(event) => updateMedication(index, 'type', event.target.value)} aria-label={`Medication ${index + 1} type`} disabled={locked}>
                            <option>Medication</option><option>Supplement</option>
                          </select>
                          {flagged && <span className="st-row-flag"><AlertTriangle size={11} /> Interaction</span>}
                        </div>
                        <input value={row.name} onChange={(event) => updateMedication(index, 'name', event.target.value)} placeholder="e.g. Tab Telmisartan 40" aria-label={`Medication ${index + 1} name`} disabled={locked} />
                        <input className="st-med-note" value={row.composition} onChange={(event) => updateMedication(index, 'composition', event.target.value)} placeholder="Dose / composition note" aria-label={`Medication ${index + 1} composition`} disabled={locked} />
                        <details className="st-med-more">
                          <summary>Brand &amp; changes</summary>
                          <div className="st-med-extra">
                            <input value={row.brand} onChange={(event) => updateMedication(index, 'brand', event.target.value)} placeholder="Brand" aria-label={`Medication ${index + 1} brand`} disabled={locked} />
                            <input value={row.changes} onChange={(event) => updateMedication(index, 'changes', event.target.value)} placeholder="Any changes" aria-label={`Medication ${index + 1} changes`} disabled={locked} />
                          </div>
                        </details>
                        </div>
                      </td>
                      <td>
                        <div className="st-dose-cell">
                          <input className="st-qty" type="number" min={0} step="0.5" value={row.quantity} onChange={(event) => updateMedication(index, 'quantity', numberValue(event.target.value))} aria-label={`Medication ${index + 1} quantity`} disabled={locked} />
                          <select value={row.dosage_per} onChange={(event) => updateMedication(index, 'dosage_per', event.target.value)} aria-label={`Medication ${index + 1} frequency`} disabled={locked}>
                            {['Once daily', 'Twice daily', 'Thrice daily', 'Weekly', 'Monthly', 'SOS'].map((option) => <option key={option}>{option}</option>)}
                            {!['Once daily', 'Twice daily', 'Thrice daily', 'Weekly', 'Monthly', 'SOS'].includes(row.dosage_per) && <option>{row.dosage_per}</option>}
                          </select>
                        </div>
                      </td>
                      <td>
                        <select value={row.time} onChange={(event) => updateMedication(index, 'time', event.target.value)} aria-label={`Medication ${index + 1} timing`} disabled={locked}>
                          {['Before breakfast', 'With breakfast', 'After breakfast', 'Before lunch', 'With lunch', 'After lunch', 'Evening', 'Before dinner', 'With dinner', 'Bedtime', 'SOS'].map((option) => <option key={option}>{option}</option>)}
                          {row.time && !['Before breakfast', 'With breakfast', 'After breakfast', 'Before lunch', 'With lunch', 'After lunch', 'Evening', 'Before dinner', 'With dinner', 'Bedtime', 'SOS'].includes(row.time) && <option>{row.time}</option>}
                        </select>
                      </td>
                      <td><input className="st-date-input" type="date" value={row.taking_since} onChange={(event) => updateMedication(index, 'taking_since', event.target.value)} aria-label={`Medication ${index + 1} taking since`} disabled={locked} /></td>
                      <td><button type="button" className="st-icon-danger" onClick={() => removeMedication(index)} disabled={locked} aria-label={`Remove medication ${index + 1}`}><Trash2 size={14} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className="st-tip">
        <Info size={15} />
        <p>Interaction checks are rule-based prompts, not a prescribing decision. Confirm timing and monitoring with the treating doctor.</p>
        <span className="st-tip-meta">{detail.client.name} · {medications.length} medicine{medications.length === 1 ? '' : 's'} · {supplements.length} supplement{supplements.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 07 review */

export function ReviewSection({
  data,
  detail,
  derived,
  locked,
  update,
  onJump,
  onPublish,
  onPreview,
  onSave,
  saving,
  dirty
}: SectionProps) {
  const readiness = derived.readiness
  const macroWarning = warningFor(derived, 'protein_deviation')
  const published = detail.strategy.status !== 'draft'

  return (
    <div className="st-section">
      <SectionHeader
        eyebrow="07 · Review"
        title={detail.strategy.status === 'archived' ? 'This version is archived and locked' : published ? 'This strategy is published and locked' : 'Read it once more, then publish it'}
        lede="The checklist is the publish gate. Fix anything unresolved, record the clinical sign-off, and send the plan to the client."
        actions={
          published ? (
            <button type="button" className="primary-button" onClick={onPreview}><Info size={15} /> View plan</button>
          ) : (
            <>
              <button type="button" className="secondary-button" onClick={onPreview}><Info size={15} /> Preview</button>
              <button type="button" className="primary-button" onClick={onPublish}><ShieldCheck size={15} /> Publish</button>
            </>
          )
        }
      />

      <div className="st-review-top">
        <div className="st-review-score">
          <div className="st-score-ring" style={{ '--score': `${readiness.score}%` } as React.CSSProperties}>
            <strong>{readiness.score}%</strong>
          </div>
          <div>
            <span className="st-eyebrow">Publish readiness</span>
            <h3>{readiness.can_publish ? 'Ready to publish' : `${readiness.blockers.length} item${readiness.blockers.length === 1 ? '' : 's'} need attention`}</h3>
            <p>{readiness.required_passed} of {readiness.required_total} required checks complete.</p>
          </div>
        </div>
        <div className="st-review-plan">
          <span>Plan</span>
          <strong>{data.meta.name}</strong>
          <small>{data.meta.diet_type} · {data.meta.patient_type} · {derived.calories.calories ? `${derived.calories.calories.toLocaleString()} kcal` : 'no calories'} · {derived.totals.days_complete}/7 days</small>
        </div>
      </div>

      <div className="st-readiness-list">
        {readiness.checks.map((check) => <ReadinessRow key={check.id} check={check} onJump={(section) => onJump(section as SectionId)} />)}
      </div>

      <div className="st-card-block">
        <div className="st-block-head"><div><h3><ShieldCheck size={16} /> Clinical sign-off</h3><p>Recorded with the published version and your local practitioner identity.</p></div></div>
        <div className="st-governance">
          <CheckRow
            checked={Boolean(data.governance.reviewed_clinical)}
            onChange={(value) => update(['governance', 'reviewed_clinical'], value)}
            title="I reviewed the clinical context, labs, and food guardrails"
            description="Conditions, medications, allergies, and deranged parameters are current as of this strategy. Recommended before publishing; enforced when NUTRIALIGN_REQUIRE_SIGNOFF is enabled."
            badge="Recommended"
            disabled={locked}
          />
          {macroWarning && (
            <CheckRow
              checked={Boolean(data.governance.acknowledged_macro_deviation)}
              onChange={(value) => update(['governance', 'acknowledged_macro_deviation'], value)}
              title="I reviewed the protein deviation"
              description={macroWarning.message}
              badge="Required"
              disabled={locked}
            />
          )}
        </div>
      </div>

      <div className="st-grid st-grid-2">
        <Field label="Client request" hint="Any particular request from the client.">
          <textarea rows={3} value={data.notes.client_request} onChange={(event) => update(['notes', 'client_request'], event.target.value)} placeholder="e.g. no repeated meals; early dinner" disabled={locked} />
        </Field>
        <Field label="Other points">
          <textarea rows={3} value={data.notes.other} onChange={(event) => update(['notes', 'other'], event.target.value)} placeholder="e.g. SS + QC = LYGIA" disabled={locked} />
        </Field>
      </div>

      <div className="st-recommendation-grid">
        {(['weight', 'medical', 'symptoms', 'immunity'] as const).map((key) => (
          <Field key={key} label={key === 'weight' ? 'For weight loss / gain' : key === 'medical' ? 'For medical condition' : key === 'symptoms' ? 'For symptoms' : 'For immunity'}>
            <input value={data.recommendations[key]} onChange={(event) => update(['recommendations', key], event.target.value)} placeholder="ALL" disabled={locked} />
          </Field>
        ))}
      </div>

      <Field label="Internal note" hint="Not shown on the client plan.">
        <textarea rows={3} value={data.notes.internal} onChange={(event) => update(['notes', 'internal'], event.target.value)} placeholder="Handover note, next review date, or rationale" disabled={locked} />
      </Field>

      {!locked && (
        <div className="st-review-actions">
          <div>
            <span className={`st-save-state ${dirty ? 'dirty' : ''}`}>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          </div>
          <div className="st-review-buttons">
            <button type="button" className="secondary-button" onClick={onSave} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button type="button" className="primary-button" onClick={onPublish}><ShieldCheck size={15} /> Publish strategy</button>
          </div>
        </div>
      )}

      {published && (
        <div className="st-published-note">
          <CheckCircle2 size={17} />
          <div>
            {detail.strategy.status === 'archived' ? (
              <>
                <strong>Archived v{detail.strategy.version}</strong>
                <p>This version is immutable and has been superseded. Open the current published plan to revise.</p>
              </>
            ) : (
              <>
                <strong>Published v{detail.strategy.version} on {formatShortDate(detail.strategy.published_at)}</strong>
                <p>This version is immutable. Create a revision to change targets, macros, or food strategy.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
