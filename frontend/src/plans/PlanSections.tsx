import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flame,
  Leaf,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wand2
} from 'lucide-react'
import type { PlanData, PlanDetail, PlanReference, PlanDerived, ReadinessCheck, Warning } from './types'
import { applyTargets, dayTotals, formatShortDate, gramsFromRatio, numberValue, rebalanceRatio, round } from './utils'
import { Ring } from '../strategy/StrategyUI'
import { getStrategy, listStrategies } from '../strategy/api'
import { savePlanTemplate } from './api'

type Common = {
  data: PlanData
  detail: PlanDetail
  reference: PlanReference
  derived: PlanDerived
  locked: boolean
  update: (path: (string | number)[], value: unknown) => void
  onJump: (section: string) => void
  onToast: (message: string) => void
}

const DURATIONS = [7, 14, 21, 30, 60, 90, 180]
const DIET_TYPES = ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan', 'Jain', 'Gluten free', 'Dairy free']

export function DetailsSection({ data, detail, locked, update, onToast }: Common) {
  const meta = data.meta
  const [linking, setLinking] = useState(false)
  const [strategies, setStrategies] = useState<{ id: string; name: string; status: string }[]>([])
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    let cancelled = false
    listStrategies(detail.client.id)
      .then((result) => {
        if (!cancelled) setStrategies(result.strategies.map((item) => ({ id: item.id, name: item.name, status: item.status })))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [detail.client.id])

  async function saveTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      const template = await savePlanTemplate(detail.client.id, detail.plan.id, { name: templateName.trim(), description: `${data.meta.diet_type} · ${data.meta.duration_days} days` })
      setTemplateName('')
      onToast(`Saved “${template.name}” as a reusable template`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save the template')
    } finally {
      setSavingTemplate(false)
    }
  }

  function setMeta(patch: Partial<PlanData['meta']>) {
    update(['meta'], { ...meta, ...patch })
  }

  function setDuration(value: number) {
    const days = Math.max(1, Math.round(value))
    const start = new Date(`${meta.start_date}T00:00:00`)
    let end = ''
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + days - 1)
      end = start.toISOString().slice(0, 10)
    }
    setMeta({ duration_days: days, end_date: end })
  }

  async function pullStrategy(overrideId?: string) {
    const targetId = overrideId || meta.strategy_id || detail.strategy?.id
    if (!targetId) return
    setLinking(true)
    try {
      const strategy = await getStrategy(detail.client.id, targetId)
      const derived = strategy.derived
      const calories = numberValue(derived.calories?.calories)
      const ratio = derived.week?.[0]?.ratio ?? derived.totals
      const protein = numberValue(derived.protein?.mid_g)
      if (!calories) {
        onToast('That strategy has no calorie target yet')
        return
      }
      update(['targets'], {
        ...data.targets,
        calories: Math.round(calories),
        protein_g: Math.round(protein),
        carbs_g: round(((calories * numberValue(ratio?.cho)) / 100) / 4, 0),
        fat_g: round(((calories * numberValue(ratio?.fat)) / 100) / 9, 0),
        ratio: { cho: numberValue(ratio?.cho), pro: numberValue(ratio?.pro), fat: numberValue(ratio?.fat) },
        protein_range: derived.protein?.range ?? '',
        source: 'strategy',
        note: derived.calories?.note ?? ''
      })
      onToast(`Targets pulled from ${strategy.strategy.name || 'the selected strategy'}`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to read the strategy')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="pl-stack">
      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><FileText size={13} /> Plan details</span>
            <h2>What is this plan, and when does it run?</h2>
            <p>The title and dates print on the cover page of the PDF.</p>
          </div>
        </header>
        <div className="pl-form-grid">
          <label className="cf-field pl-span-2">
            <span className="cf-label">Plan title</span>
            <input value={meta.title} disabled={locked} onChange={(event) => setMeta({ title: event.target.value })} placeholder="e.g. Aug 2026 — tennis performance block" />
          </label>
          <label className="cf-field">
            <span className="cf-label">Start date</span>
            <input type="date" value={meta.start_date} disabled={locked} onChange={(event) => setMeta({ start_date: event.target.value })} />
          </label>
          <label className="cf-field">
            <span className="cf-label">Program duration</span>
            <select value={meta.duration_days} disabled={locked} onChange={(event) => setDuration(numberValue(event.target.value))}>
              {[...new Set([...DURATIONS, meta.duration_days])].filter(Boolean).sort((a, b) => a - b).map((days) => (
                <option key={days} value={days}>{days} days</option>
              ))}
            </select>
          </label>
          <label className="cf-field">
            <span className="cf-label">End date</span>
            <input value={formatShortDate(meta.end_date)} readOnly aria-readonly="true" />
          </label>
          <label className="cf-field">
            <span className="cf-label">Diet type</span>
            <select value={meta.diet_type} disabled={locked} onChange={(event) => setMeta({ diet_type: event.target.value })}>
              {[...new Set([...DIET_TYPES, meta.diet_type])].filter(Boolean).map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="cf-field">
            <span className="cf-label">Prepared by</span>
            <input value={meta.prepared_by} disabled={locked} onChange={(event) => setMeta({ prepared_by: event.target.value })} />
          </label>
          <label className="cf-field pl-span-3">
            <span className="cf-label">Internal description</span>
            <textarea rows={2} value={meta.description} disabled={locked} onChange={(event) => setMeta({ description: event.target.value })} placeholder="Not printed — context for the next review" />
          </label>
        </div>
      </section>

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><Link2 size={13} /> Strategy link</span>
            <h2>Carry the clinical targets over</h2>
            <p>The plan stays independent, so you can tune portions without touching the signed strategy.</p>
          </div>
          <button type="button" className="secondary-button compact" onClick={() => void pullStrategy()} disabled={locked || !detail.strategy || linking}>
            {linking ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Pull targets from strategy
          </button>
        </header>
        <div className="pl-strategy-picker">
          <label className="cf-field">
            <span className="cf-label">Linked strategy</span>
            <select
              value={meta.strategy_id}
              disabled={locked}
              onChange={(event) => {
                const picked = strategies.find((item) => item.id === event.target.value)
                setMeta({ strategy_id: event.target.value, strategy_name: picked?.name ?? '' })
                if (picked) void pullStrategy(event.target.value)
              }}
            >
              <option value="">No strategy linked</option>
              {strategies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.status}
                </option>
              ))}
            </select>
          </label>
          <span className="pl-strategy-hint">Selecting a strategy links it and pulls its energy and protein targets.</span>
        </div>
        {detail.strategy ? (
          <div className="pl-link-card">
            <span className="pl-link-icon"><Target size={18} /></span>
            <div>
              <strong>{detail.strategy.name || 'Published strategy'}</strong>
              <small>
                {detail.strategy.status} · {detail.strategy.calories ? `${detail.strategy.calories.toLocaleString()} kcal` : 'no calorie target'} ·
                {' '}linked to this plan
              </small>
            </div>
            <span className={`cf-badge ${detail.strategy.status === 'published' ? 'consent' : ''}`}>{detail.strategy.status}</span>
          </div>
        ) : (
          <div className="pl-link-card empty">
            <span className="pl-link-icon"><AlertCircle size={18} /></span>
            <div>
              <strong>No strategy linked</strong>
              <small>Publish a strategy for this client to carry its energy and protein targets into the plan.</small>
            </div>
          </div>
        )}
      </section>

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><ClipboardList size={13} /> Reuse this week</span>
            <h2>Save as a template</h2>
            <p>Templates appear in the “New plan” menu so the same rotation can be dropped onto another client.</p>
          </div>
        </header>
        <div className="pl-template-save">
          <input
            value={templateName}
            disabled={locked}
            placeholder="Template name, e.g. Tennis training week"
            aria-label="Template name"
            onChange={(event) => setTemplateName(event.target.value)}
          />
          <button type="button" className="secondary-button compact" disabled={locked || !templateName.trim() || savingTemplate} onClick={() => void saveTemplate()}>
            {savingTemplate ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Save template
          </button>
        </div>
      </section>

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><Leaf size={13} /> PDF branding</span>
            <h2>Which practice appears on the plan?</h2>
            <p>These details print in the header and footer of every page.</p>
          </div>
        </header>
        <div className="pl-form-grid">
          <label className="cf-field">
            <span className="cf-label">Practice name</span>
            <input value={data.brand.name} disabled={locked} onChange={(event) => update(['brand'], { ...data.brand, name: event.target.value })} />
          </label>
          <label className="cf-field pl-span-2">
            <span className="cf-label">Tagline</span>
            <input value={data.brand.tagline} disabled={locked} onChange={(event) => update(['brand'], { ...data.brand, tagline: event.target.value })} />
          </label>
          <label className="cf-field">
            <span className="cf-label">Support email</span>
            <input value={data.brand.email} disabled={locked} onChange={(event) => update(['brand'], { ...data.brand, email: event.target.value })} />
          </label>
          <label className="cf-field">
            <span className="cf-label">Phone</span>
            <input value={data.brand.phone} disabled={locked} onChange={(event) => update(['brand'], { ...data.brand, phone: event.target.value })} />
          </label>
          <label className="cf-field">
            <span className="cf-label">Footer credit</span>
            <input value={data.brand.powered_by} disabled={locked} onChange={(event) => update(['brand'], { ...data.brand, powered_by: event.target.value })} />
          </label>
        </div>
      </section>
    </div>
  )
}

export function TargetsSection({ data, detail, locked, update, onToast }: Common) {
  const targets = data.targets
  const ratio = targets.ratio
  const grams = gramsFromRatio(targets.calories, ratio)
  const totals = round(ratio.cho + ratio.pro + ratio.fat)

  function setCalories(value: number) {
    update(['targets'], { ...targets, calories: Math.round(value), ...pickGrams(gramsFromRatio(value, ratio)) })
  }

  function setRatio(next: { cho: number; pro: number; fat: number }) {
    update(['targets'], { ...targets, ratio: next, ...pickGrams(gramsFromRatio(targets.calories, next)) })
  }

  function editPercentage(key: 'cho' | 'pro' | 'fat', value: number) {
    setRatio(rebalanceRatio(ratio, key, value))
  }

  function setProteinGrams(value: number) {
    const calories = numberValue(targets.calories)
    if (!calories) {
      update(['targets'], { ...targets, protein_g: Math.round(value) })
      return
    }
    const pro = Math.min(60, Math.max(5, Math.round(((value * 4) / calories) * 100)))
    const fat = ratio.fat
    const next = { cho: Math.max(0, 100 - pro - fat), pro, fat }
    setRatio(next)
  }

  function matchFromMeals() {
    const active = data.days.filter((day) => day.active)
    if (!active.length) return
    const average = active.reduce((sum, day) => sum + dayTotals(day).calories, 0) / active.length
    if (!average) return
    setCalories(average)
    onToast(`Target set to the ${Math.round(average).toLocaleString()} kcal average of the week`)
  }

  const weight = numberValue(data.clinical.weight_kg)
  const perKg = weight ? round(targets.protein_g / weight, 2) : 0
  const guardrail = (targets.protein_range || '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? null
  const outOfRange = Boolean(perKg && guardrail && guardrail.length >= 1 && (perKg < guardrail[0] || perKg > (guardrail[1] ?? guardrail[0])))

  return (
    <div className="pl-stack">
      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><Calculator size={13} /> Energy and macros</span>
            <h2>One target, three percentages, always 100%</h2>
            <p>Change the energy or the protein grams and the percentages rebalance themselves.</p>
          </div>
          <button type="button" className="secondary-button compact" onClick={matchFromMeals} disabled={locked}>
            <Wand2 size={14} /> Match to planned week
          </button>
        </header>

        <div className="pl-target-grid">
          <label className="cf-field">
            <span className="cf-label">Daily energy target (kcal)</span>
            <input type="number" min={0} step={50} value={targets.calories} disabled={locked} onChange={(event) => setCalories(numberValue(event.target.value))} />
          </label>
          <label className="cf-field">
            <span className="cf-label">Protein target (g / day)</span>
            <input type="number" min={0} step={5} value={targets.protein_g} disabled={locked} onChange={(event) => setProteinGrams(numberValue(event.target.value))} />
            <span className={`pl-protein-hint ${outOfRange ? 'warn' : ''}`}>
              {perKg ? `${perKg} g/kg of ${weight} kg` : 'Add a weight to see g/kg'}
              {guardrail ? ` · guardrail ${guardrail[0]}–${guardrail[1]} g/kg` : ''}
              {outOfRange ? ' · outside the strategy guardrail' : ''}
            </span>
          </label>
          <div className="pl-target-source">
            <span>Source</span>
            <strong>{targets.source === 'strategy' ? 'Published strategy' : targets.source === 'day' ? 'Day override' : 'Manual'}</strong>
            <small>{targets.note || 'Set in the plan studio'}</small>
          </div>
        </div>

        <div className="pl-ratio-head">
          <span className="cf-label">Macro split</span>
          <span className={totals === 100 ? 'pl-total ok' : 'pl-total bad'}>Total {totals}%</span>
        </div>
        <div className="pl-ratio-grid">
          <label className="pl-ratio-field cho">
            <span>Carbohydrate</span>
            <input type="number" min={0} max={100} value={ratio.cho} disabled={locked} onChange={(event) => editPercentage('cho', numberValue(event.target.value))} aria-label="Carbohydrate percentage" />
            <small>{grams.carbs} g · {Math.round((targets.calories * ratio.cho) / 100)} kcal</small>
          </label>
          <label className="pl-ratio-field pro">
            <span>Protein</span>
            <input type="number" min={0} max={100} value={ratio.pro} disabled={locked} onChange={(event) => editPercentage('pro', numberValue(event.target.value))} aria-label="Protein percentage" />
            <small>{grams.protein} g · {Math.round((targets.calories * ratio.pro) / 100)} kcal</small>
          </label>
          <label className="pl-ratio-field fat">
            <span>Fat</span>
            <input type="number" min={0} max={100} value={ratio.fat} disabled={locked} onChange={(event) => editPercentage('fat', numberValue(event.target.value))} aria-label="Fat percentage" />
            <small>{grams.fat} g · {Math.round((targets.calories * ratio.fat) / 100)} kcal</small>
          </label>
        </div>
        <div className="pl-ratio-bar" aria-hidden="true">
          <span className="cho" style={{ width: `${ratio.cho}%` }} />
          <span className="pro" style={{ width: `${ratio.pro}%` }} />
          <span className="fat" style={{ width: `${ratio.fat}%` }} />
        </div>
        <p className="pl-check-energy">
          <Flame size={13} /> {grams.protein * 4 + grams.carbs * 4 + grams.fat * 9} kcal from macros · target {targets.calories.toLocaleString()} kcal
        </p>
      </section>

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><Target size={13} /> Day overrides</span>
            <h2>Training days can run higher</h2>
            <p>Leave a day on the plan target, or set its own energy when the loading changes.</p>
          </div>
          <button
            type="button"
            className="secondary-button compact"
            disabled={locked || !data.days.some((day) => day.targets)}
            onClick={() => {
              update(['days'], data.days.map((day) => ({ ...day, targets: undefined })))
              onToast('Every day now follows the plan target')
            }}
          >
            Reset all day overrides
          </button>
        </header>
        <div className="pl-target-table">
          <div className="pl-target-table-head">
            <span>Day</span><span>Meals</span><span>Planned</span><span>Target</span><span>Difference</span><span />
          </div>
          {data.days.map((day, index) => {
            const totalsDay = dayTotals(day)
            const dayTarget = day.targets ?? targets
            const diff = Math.round(totalsDay.calories - dayTarget.calories)
            return (
              <div className={`pl-target-row ${day.active ? '' : 'off'}`} key={day.day}>
                <span className="pl-target-day">{day.day}<small>{day.active ? formatShortDate(day.date) : 'inactive'}</small></span>
                <span>{totalsDay.meals}</span>
                <span>{Math.round(totalsDay.calories).toLocaleString()} kcal</span>
                <span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={dayTarget.calories}
                    disabled={locked}
                    aria-label={`${day.day} energy target`}
                    onChange={(event) => {
                      const calories = numberValue(event.target.value)
                      const next = applyTargets(calories, dayTarget.ratio ?? targets.ratio)
                      update(['days', index, 'targets'], next)
                    }}
                  />
                </span>
                <span className={Math.abs(diff) <= targets.calories * 0.1 ? 'ok' : 'warn'}>
                  {diff === 0 ? '—' : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString()}`}
                </span>
                <span>
                  {day.targets && (
                    <button type="button" className="pl-link" disabled={locked} onClick={() => update(['days', index, 'targets'], undefined)}>
                      Use plan target
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function LibrarySection({ data, reference, locked, update }: Common) {
  const selected = data.extras.superfoods
  const [note, setNote] = useState({ heading: '', body: '' })

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    update(['extras', 'superfoods'], next)
  }

  return (
    <div className="pl-stack">
      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><Sparkles size={13} /> Recommendations</span>
            <h2>Superfoods for this client</h2>
            <p>Each selection prints with its rationale on the recommendations page.</p>
          </div>
          <span className="pl-chip-static">{selected.length} selected</span>
        </header>
        <div className="pl-superfood-grid">
          {reference.superfoods.map((item) => {
            const active = selected.includes(item.id)
            return (
              <button type="button" key={item.id} className={`pl-superfood ${active ? 'active' : ''}`} onClick={() => toggle(item.id)} disabled={locked} aria-pressed={active}>
                <span className="pl-superfood-check" aria-hidden="true">{active ? <Check size={12} /> : <Plus size={12} />}</span>
                <strong>{item.name}</strong>
                <small>{item.note}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><ClipboardList size={13} /> Added guidance</span>
            <h2>Notes that print with the recommendations</h2>
            <p>Use these for lab-specific advice, supplement timing or a message from the practitioner.</p>
          </div>
        </header>
        <div className="pl-note-list">
          {data.extras.custom_notes.map((item, index) => (
            <div className="pl-note-row" key={item.id}>
              <input
                value={item.heading}
                disabled={locked}
                placeholder="Heading"
                aria-label="Note heading"
                onChange={(event) => update(['extras', 'custom_notes', index, 'heading'], event.target.value)}
              />
              <input
                value={item.body}
                disabled={locked}
                placeholder="Note text"
                aria-label="Note body"
                onChange={(event) => update(['extras', 'custom_notes', index, 'body'], event.target.value)}
              />
              <button type="button" className="pl-icon danger" aria-label="Remove note" disabled={locked} onClick={() => update(['extras', 'custom_notes'], data.extras.custom_notes.filter((_, position) => position !== index))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="pl-note-add">
          <input value={note.heading} onChange={(event) => setNote({ ...note, heading: event.target.value })} placeholder="New heading" aria-label="New note heading" />
          <input value={note.body} onChange={(event) => setNote({ ...note, body: event.target.value })} placeholder="New note text" aria-label="New note text" />
          <button
            type="button"
            className="secondary-button compact"
            disabled={locked || (!note.heading.trim() && !note.body.trim())}
            onClick={() => {
              update(['extras', 'custom_notes'], [...data.extras.custom_notes, { id: `note_${Date.now()}`, heading: note.heading, body: note.body }])
              setNote({ heading: '', body: '' })
            }}
          >
            <Plus size={14} /> Add note
          </button>
        </div>
      </section>

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><FileText size={13} /> Printed sections</span>
            <h2>What else goes in the PDF</h2>
          </div>
        </header>
        <div className="pl-toggles">
          <label className="pl-toggle-row">
            <input type="checkbox" checked={data.extras.measurements} disabled={locked} onChange={(event) => update(['extras', 'measurements'], event.target.checked)} />
            <span><strong>Standard measurements guide</strong><small>Teaspoon, katori, bowl, glass and cup conversions.</small></span>
          </label>
          <label className="pl-toggle-row">
            <input type="checkbox" checked={data.extras.disclaimer} disabled={locked} onChange={(event) => update(['extras', 'disclaimer'], event.target.checked)} />
            <span><strong>Disclaimer</strong><small>Practice liability and scope-of-advice statement.</small></span>
          </label>
          <label className="pl-toggle-row">
            <input type="checkbox" checked={data.extras.show_targets} disabled={locked} onChange={(event) => update(['extras', 'show_targets'], event.target.checked)} />
            <span><strong>Daily target line</strong><small>Shows planned versus target energy under each day.</small></span>
          </label>
        </div>
      </section>
    </div>
  )
}

export function GuidelinesSection({ data, reference, locked, update }: Common) {
  const selected = data.extras.guidelines
  const all = reference.guidelines.map((item) => item.id)
  return (
    <div className="pl-stack">
      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><FileText size={13} /> General guidelines</span>
            <h2>{selected.length} of {all.length} sections included</h2>
            <p>These print after the meal tables and before the disclaimer.</p>
          </div>
          <div className="pl-head-actions">
            <button type="button" className="secondary-button compact" disabled={locked} onClick={() => update(['extras', 'guidelines'], all)}>Select all</button>
            <button type="button" className="secondary-button compact" disabled={locked} onClick={() => update(['extras', 'guidelines'], [])}>Clear</button>
          </div>
        </header>
        <div className="pl-guideline-grid">
          {reference.guidelines.map((item, index) => {
            const active = selected.includes(item.id)
            return (
              <label className={`pl-guideline ${active ? 'active' : ''}`} key={item.id}>
                <input
                  type="checkbox"
                  checked={active}
                  disabled={locked}
                  onChange={() => update(['extras', 'guidelines'], active ? selected.filter((id) => id !== item.id) : [...all.filter((id) => selected.includes(id) || id === item.id)])}
                />
                <span className="pl-guideline-num">{index + 1}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.paragraphs[0]}</small>
                </span>
              </label>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function ReviewSection({
  data,
  detail,
  derived,
  locked,
  update,
  onJump,
  onPublish,
  onPreview,
  publishing
}: Common & { onPublish: (attestation: boolean, note: string) => void; onPreview: () => void; publishing: boolean }) {
  const [attestation, setAttestation] = useState(false)
  const [note, setNote] = useState('')
  const readiness = derived.readiness
  const published = detail.plan.status === 'published'

  return (
    <div className="pl-stack">
      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><ShieldCheck size={13} /> Review & publish</span>
            <h2>{published ? `Published v${detail.plan.version}` : readiness.ready ? 'Ready to publish' : 'Not ready yet'}</h2>
            <p>
              {published
                ? 'This version is locked. Create a revision to change meals or targets.'
                : 'Publishing locks the plan and stamps the PDF as approved.'}
            </p>
          </div>
          <div className="pl-review-score">
            <Ring value={readiness.score} size={56} />
            <span>{readiness.checks.filter((check) => check.status === 'pass').length} of {readiness.checks.length} checks</span>
          </div>
        </header>

        <div className="pl-check-list">
          {readiness.checks.map((check: ReadinessCheck) => (
            <div className={`pl-check ${check.status}`} key={check.id}>
              <span className="pl-check-icon" aria-hidden="true">
                {check.status === 'pass' ? <Check size={13} /> : check.status === 'warn' ? <AlertCircle size={13} /> : <AlertCircle size={13} />}
              </span>
              <span className="pl-check-copy">
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </span>
              {check.status !== 'pass' && (
                <button type="button" className="pl-link" onClick={() => onJump(check.section)}>Fix</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {derived.warnings.length > 0 && (
        <section className="pl-card">
          <header className="pl-card-head">
            <div>
              <span className="pl-eyebrow"><AlertCircle size={13} /> Guardrails</span>
              <h2>What needs a decision</h2>
            </div>
          </header>
          <div className="pl-warnings">
            {derived.warnings.map((warning: Warning) => {
              const acknowledged = warning.ack_key ? Boolean(data.governance[warning.ack_key as keyof PlanData['governance']]) : false
              return (
                <div className={`pl-warning ${warning.severity}`} key={warning.id}>
                  <div>
                    <strong>{warning.title}</strong>
                    <p>{warning.message}</p>
                  </div>
                  {warning.ack_key && (
                    <label className="pl-ack">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        disabled={locked}
                        onChange={(event) => update(['governance', warning.ack_key as string], event.target.checked)}
                      />
                      Acknowledge
                    </label>
                  )}
                </div>
              )
            })}
            {derived.conflicts.length > 0 && (
              <ul className="pl-conflict-list">
                {derived.conflicts.slice(0, 8).map((conflict, index) => (
                  <li key={`${conflict.meal}-${index}`}>
                    <span>{conflict.day} · {conflict.slot}</span>
                    <strong>{conflict.meal}</strong>
                    <small>{conflict.reason}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="pl-card">
        <header className="pl-card-head">
          <div>
            <span className="pl-eyebrow"><CheckCircle2 size={13} /> Sign-off</span>
            <h2>Publish the plan</h2>
          </div>
        </header>
        {published ? (
          <div className="pl-published-row">
            <span className="pl-status-pill published"><span /> Published v{detail.plan.version} · {formatShortDate(detail.plan.published_at)}</span>
            <button type="button" className="secondary-button" onClick={onPreview}><FileText size={15} /> Open the PDF</button>
          </div>
        ) : (
          <>
            <label className="pl-ack big">
              <input type="checkbox" checked={attestation} disabled={locked} onChange={(event) => setAttestation(event.target.checked)} />
              <span>
                <strong>I reviewed this plan</strong>
                <small>Portions, calories, guardrails and the printed PDF were checked before publishing.</small>
              </span>
            </label>
            <label className="cf-field">
              <span className="cf-label">Publish note (optional)</span>
              <textarea rows={2} value={note} disabled={locked} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Reviewed with the client on a call" />
            </label>
            <div className="pl-publish-actions">
              <button type="button" className="secondary-button" onClick={onPreview}><FileText size={15} /> Preview PDF</button>
              <button type="button" className="primary-button" disabled={!attestation || publishing || locked || !readiness.ready} onClick={() => onPublish(attestation, note)}>
                {publishing ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                {publishing ? 'Publishing…' : 'Publish plan'}
              </button>
            </div>
            {!readiness.ready && (
              <p className="pl-publish-hint">
                <AlertCircle size={13} /> Resolve the failing checks above to enable publishing.
              </p>
            )}
          </>
        )}
      </section>

      <p className="pl-foot-note">
        <ArrowRight size={13} /> Need a different version? Duplicate this plan from the client's plan history.
      </p>
    </div>
  )
}

function pickGrams(grams: { protein: number; carbs: number; fat: number }) {
  return { protein_g: grams.protein, carbs_g: grams.carbs, fat_g: grams.fat }
}
