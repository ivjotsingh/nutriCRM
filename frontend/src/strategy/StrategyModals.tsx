import { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import type { MacroBreakdown, MacroDay, MacroRatio, Reference, StrategyDetail } from './types'
import { Modal, ModalClose } from '../clients/ui'
import { MacroBar } from './StrategyUI'
import { formatDateTime, formatShortDate, numberValue } from './utils'

function previewMacros(calories: number, ratio: MacroRatio): MacroBreakdown {
  const choKcal = (calories * ratio.cho) / 100
  const proKcal = (calories * ratio.pro) / 100
  const fatKcal = (calories * ratio.fat) / 100
  return {
    ratio,
    pct_total: ratio.cho + ratio.pro + ratio.fat,
    kcal: { cho: choKcal, pro: proKcal, fat: fatKcal },
    grams: {
      cho: Math.floor(choKcal / 4),
      pro: Math.floor(proKcal / 4),
      fat: Math.floor(fatKcal / 9)
    }
  }
}

function rangeFor(label: string, weight: number) {
  const numbers = label.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [1.2, 1.4]
  const low = numbers[0] ?? 1.2
  const high = numbers[1] ?? low + 0.2
  return { low, high, min: low * weight, max: high * weight }
}

/* ------------------------------------------------------------------ macro day */

export function MacroDayModal({
  day,
  open,
  reference,
  targetWeight,
  onClose,
  onSave,
  onSaveTo
}: {
  day: MacroDay | null
  open: boolean
  reference: Reference
  targetWeight: number
  onClose: () => void
  onSave: (day: MacroDay) => void
  onSaveTo: (day: MacroDay, target: 'all' | 'weekdays' | 'weekend') => void
}) {
  const [draft, setDraft] = useState<MacroDay | null>(null)
  const [copyTarget, setCopyTarget] = useState<'all' | 'weekdays' | 'weekend'>('all')

  useEffect(() => {
    if (open && day) setDraft(JSON.parse(JSON.stringify(day)) as MacroDay)
  }, [open, day])

  if (!open || !draft) return null

  const calories = numberValue(draft.calories)
  const ratio = {
    cho: numberValue(draft.ratio.cho),
    pro: numberValue(draft.ratio.pro),
    fat: numberValue(draft.ratio.fat)
  }
  const total = ratio.cho + ratio.pro + ratio.fat
  const breakdown = previewMacros(calories, ratio)
  const target = rangeFor(draft.protein_target, targetWeight)
  const achieved = targetWeight ? breakdown.grams.pro / targetWeight : 0
  const valid = total === 100 && calories > 0 && Boolean(draft.protein_target)

  function patch(next: Partial<MacroDay>) {
    setDraft((current) => current ? { ...current, ...next } : current)
  }

  function patchRatio(key: keyof MacroRatio, value: number) {
    setDraft((current) => current ? { ...current, ratio: { ...current.ratio, [key]: value } } : current)
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="macro-day-title" className="st-modal-wide">
      <div className="st-modal-head">
        <div>
          <span className="st-eyebrow">Macro nutrient split</span>
          <h2 id="macro-day-title">{draft.day}</h2>
          <p>Set the energy, protein guardrail, and ratio for this day. The gram targets recalculate as you type.</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>

      <div className="st-modal-body">
        <div className="st-segmented" role="radiogroup" aria-label="Formula">
          {[
            { value: 'thumb', label: 'Thumb rule', hint: 'Target weight × factor' },
            { value: 'bmr', label: 'BMR', hint: 'Katch / Mifflin' },
            { value: 'rda', label: 'RDA', hint: 'Age and sex chart' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={draft.formula === option.value}
              className={draft.formula === option.value ? 'active' : ''}
              onClick={() => patch({ formula: option.value as MacroDay['formula'] })}
            >
              <strong>{option.label}</strong><small>{option.hint}</small>
            </button>
          ))}
        </div>

        <div className="st-modal-grid">
          <label className="st-field">
            <span className="st-label">Calorie required (kcal)</span>
            <input type="number" min={0} step="10" value={calories || ''} onChange={(event) => patch({ calories: numberValue(event.target.value) })} autoFocus />
          </label>
          <label className="st-field">
            <span className="st-label">Protein target (g/kg)</span>
            <select value={draft.protein_target} onChange={(event) => patch({ protein_target: event.target.value })}>
              {reference.protein_targets.map((range) => <option key={range}>{range}</option>)}
            </select>
          </label>
        </div>

        <div className="st-ratio-editor">
          <div className="st-ratio-head">
            <span className="st-label">Nutrient ratio (%)</span>
            <span className={total === 100 ? 'st-ratio-total ok' : 'st-ratio-total bad'}>Total {total}%</span>
          </div>
          <div className="st-ratio-inputs">
            <label className="st-ratio-field cho">
              <span>Carbohydrate</span>
              <input type="number" min={0} max={100} value={ratio.cho} onChange={(event) => patchRatio('cho', numberValue(event.target.value))} />
              <small>{Math.round(breakdown.kcal.cho)} kcal · {breakdown.grams.cho} g</small>
            </label>
            <label className="st-ratio-field pro">
              <span>Protein</span>
              <input type="number" min={0} max={100} value={ratio.pro} onChange={(event) => patchRatio('pro', numberValue(event.target.value))} />
              <small>{Math.round(breakdown.kcal.pro)} kcal · {breakdown.grams.pro} g</small>
            </label>
            <label className="st-ratio-field fat">
              <span>Fat</span>
              <input type="number" min={0} max={100} value={ratio.fat} onChange={(event) => patchRatio('fat', numberValue(event.target.value))} />
              <small>{Math.round(breakdown.kcal.fat)} kcal · {breakdown.grams.fat} g</small>
            </label>
          </div>
          <MacroBar cho={breakdown.kcal.cho} pro={breakdown.kcal.pro} fat={breakdown.kcal.fat} />
        </div>

        <div className="st-modal-result">
          <div>
            <span>Protein achieved</span>
            <strong>{breakdown.grams.pro} g <em>{achieved ? `${achieved.toFixed(2)} g/kg` : '—'}</em></strong>
            <small>Target {target.low}–{target.high} g/kg · {Math.round(target.min)}–{Math.round(target.max)} g</small>
          </div>
          <div>
            <span>Status</span>
            <strong className={achieved >= target.low && achieved <= target.high ? 'ok' : 'warn'}>
              {!achieved ? 'Add target weight' : achieved < target.low ? 'Below target' : achieved > target.high ? 'Above target' : 'Within target'}
            </strong>
            <small>{calories ? `${calories.toLocaleString()} kcal across the day` : 'No calories set'}</small>
          </div>
          <div>
            <span>Macro split</span>
            <strong>{ratio.cho} / {ratio.pro} / {ratio.fat}</strong>
            <small>CHO / Pro / Fat</small>
          </div>
        </div>

        <label className="st-field">
          <span className="st-label">Note</span>
          <textarea rows={2} value={draft.note} onChange={(event) => patch({ note: event.target.value })} placeholder="Calculation or clinical note for this day" />
        </label>

        {total !== 100 && (
          <p className="st-form-error" role="alert"><AlertCircle size={14} /> The ratio must total 100% before this day can be saved.</p>
        )}
      </div>

      <div className="st-modal-actions split">
        <div className="st-copy-control">
          <label className="st-label" htmlFor="copy-target">Copy to</label>
          <select id="copy-target" value={copyTarget} onChange={(event) => setCopyTarget(event.target.value as typeof copyTarget)}>
            <option value="all">All 7 days</option>
            <option value="weekdays">Weekdays (Mon–Fri)</option>
            <option value="weekend">Weekend (Sat–Sun)</option>
          </select>
          <button type="button" className="secondary-button" onClick={() => valid && onSaveTo(draft, copyTarget)} disabled={!valid}>
            Copy
          </button>
        </div>
        <div>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => valid && onSave(draft)} disabled={!valid}>
            <Check size={15} /> Save day
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ rda */

export function RdaModal({
  open,
  reference,
  detail,
  onClose
}: {
  open: boolean
  reference: Reference
  detail: StrategyDetail
  onClose: () => void
}) {
  if (!open) return null
  const current = detail.derived.rda
  const groups: Record<string, Reference['rda_rows']> = {}
  for (const row of reference.rda_rows) {
    groups[row.group] = [...(groups[row.group] ?? []), row]
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="rda-title" className="st-modal-wide">
      <div className="st-modal-head">
        <div>
          <span className="st-eyebrow">Reference table</span>
          <h2 id="rda-title">RDA data</h2>
          <p>
            Recommended dietary allowance for energy and protein, by age, sex, body weight, and activity.
            NutriAlign highlights the row that matches this client.
          </p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <div className="st-modal-body">
        {current && (
          <div className="st-rda-match">
            <CheckCircle2 size={16} />
            <span>Matching row: <strong>{current.label}</strong> · {current.energy_kcal.toLocaleString()} kcal · {current.protein_g} g protein</span>
          </div>
        )}
        <div className="st-table-scroll" role="region" aria-label="RDA reference table" tabIndex={0}>
          <table className="st-data-table st-rda-table">
            <caption className="st-visually-hidden">RDA reference table</caption>
            <thead>
              <tr><th>Group</th><th>Category</th><th>Body weight (kg)</th><th>Energy (kcal)</th><th>Protein (g)</th></tr>
            </thead>
            {Object.entries(groups).map(([group, rows]) => (
              <tbody key={group}>
                <tr className="st-rda-group"><td colSpan={5}>{group}</td></tr>
                {rows.map((row) => {
                  const matched = current?.group === row.group && current?.category === row.category
                  return (
                    <tr key={`${group}-${row.category}`} className={matched ? 'matched' : undefined}>
                      <td>{row.group}</td>
                      <td>{row.category}{row.energy_note ? <small className="st-cell-note">{row.energy_note}</small> : null}</td>
                      <td className="st-num">{row.body_weight_kg}</td>
                      <td className="st-num">{row.energy_per_kg ? `${row.energy_per_kg}/kg` : row.energy_kcal.toLocaleString()}</td>
                      <td className="st-num">{row.protein_per_kg ? `${row.protein_per_kg}/kg` : row.protein_g}</td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
        <div className="st-note-block">
          <Info size={15} />
          <p>
            This is the practice RDA chart supplied with the brief. In RDA mode, the reference energy is adjusted by the goal mode
            for adults; children and pregnancy are never put in deficit. Confirm the edition your practice uses before publishing.
          </p>
        </div>
      </div>
      <div className="st-modal-actions">
        <button type="button" className="primary-button" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ formula */

export function FormulaModal({
  open,
  reference,
  onClose
}: {
  open: boolean
  reference: Reference
  onClose: () => void
}) {
  if (!open) return null
  const notes = reference.formula_notes
  return (
    <Modal open={open} onClose={onClose} labelledBy="formula-title" className="st-modal-wide">
      <div className="st-modal-head">
        <div>
          <span className="st-eyebrow">Method</span>
          <h2 id="formula-title">Formula explanation</h2>
          <p>Every number in the studio is deterministic and traceable. No black box.</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <div className="st-modal-body st-formula-doc">
        <section>
          <h3>1 · Body and energy</h3>
          <dl>
            <dt>BMI</dt><dd>{notes.bmi}</dd>
            <dt>BMR · Katch-McArdle</dt><dd>{notes.katch}</dd>
            <dt>BMR · Mifflin-St Jeor</dt><dd>{notes.mifflin}</dd>
            <dt>TDEE</dt><dd>{notes.tdee}</dd>
            <dt>Ideal weight</dt><dd>{notes.ideal_weight}</dd>
          </dl>
        </section>
        <section>
          <h3>2 · Thumb rule</h3>
          <p>{notes.thumb}</p>
          <div className="st-thumb-grid">
            <span />
            <strong>Sedentary</strong><strong>Moderate</strong><strong>Heavy</strong>
            {(['loss', 'maintenance', 'gain'] as const).map((mode) => (
              <div className="st-thumb-row" key={mode}>
                <strong>{mode === 'loss' ? 'Weight loss' : mode === 'gain' ? 'Weight gain' : 'Maintenance'}</strong>
                {(['sedentary', 'moderate', 'heavy'] as const).map((band) => <span key={band}>{reference.thumb_factors[mode][band]} kcal/kg</span>)}
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3>3 · RDA and macros</h3>
          <dl>
            <dt>RDA</dt><dd>{notes.rda}</dd>
            <dt>Macro grams</dt><dd>{notes.macro}</dd>
            <dt>Protein guardrail</dt><dd>{notes.protein}</dd>
            <dt>Calorie floor</dt><dd>{notes.calorie_floor}</dd>
          </dl>
        </section>
        <section>
          <h3>4 · Activity factors</h3>
          <div className="st-activity-table">
            {reference.activity_levels.map((level) => (
              <div key={level.value}><span>{level.label}</span><strong>× {level.factor}</strong><small>thumb band: {level.thumb}</small></div>
            ))}
          </div>
        </section>
      </div>
      <div className="st-modal-actions">
        <button type="button" className="primary-button" onClick={onClose}>Got it</button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ publish */

export function PublishModal({
  open,
  detail,
  onClose,
  onJump,
  onPublish,
  publishing,
  error
}: {
  open: boolean
  detail: StrategyDetail
  onClose: () => void
  onJump: (section: string) => void
  onPublish: (attestation: boolean, note: string) => Promise<void>
  publishing: boolean
  error: string
}) {
  const [attestation, setAttestation] = useState(false)
  const [note, setNote] = useState('')
  const readiness = detail.derived.readiness

  useEffect(() => {
    if (open) {
      setAttestation(false)
      setNote('')
    }
  }, [open])

  if (!open) return null
  const blockers = readiness.blockers
  const ready = readiness.can_publish && attestation

  return (
    <Modal open={open} onClose={onClose} labelledBy="publish-title" className="st-modal-wide">
      <div className="st-modal-head">
        <div>
          <span className="st-eyebrow">Sign-off</span>
          <h2 id="publish-title">Publish this strategy?</h2>
          <p>{detail.client.name} · {detail.strategy.data.meta.name} · {detail.strategy.data.meta.diet_type}</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <div className="st-modal-body">
        <div className="st-publish-stats">
          <div><span>Calories</span><strong>{detail.derived.calories.calories ? detail.derived.calories.calories.toLocaleString() : '—'}</strong><small>kcal / day</small></div>
          <div><span>Protein</span><strong>{detail.derived.totals.avg_protein}</strong><small>g / day</small></div>
          <div><span>Week</span><strong>{detail.derived.totals.days_complete}/7</strong><small>days complete</small></div>
          <div><span>Readiness</span><strong>{readiness.score}%</strong><small>{readiness.required_passed}/{readiness.required_total} checks</small></div>
        </div>

        {blockers.length > 0 ? (
          <div className="st-blocker-box">
            <div className="st-blocker-head"><AlertTriangle size={17} /><strong>{blockers.length} item{blockers.length === 1 ? '' : 's'} still need attention</strong></div>
            <ul>
              {blockers.map((blocker) => (
                <li key={blocker.id}>
                  <span><strong>{blocker.label}</strong><small>{blocker.detail}</small></span>
                  <button type="button" className="st-link" onClick={() => { onJump(blocker.section); onClose() }}>Go to section <ArrowRight size={12} /></button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="st-ready-box"><CheckCircle2 size={18} /><span>All publish checks pass. This version will be signed and locked.</span></div>
        )}

        <label className="st-field">
          <span className="st-label">Sign-off note <em className="st-optional">Optional</em></span>
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Reviewed with Dr. Shah; repeat HbA1c in 8 weeks." />
        </label>

        <label className="st-attest">
          <input type="checkbox" checked={attestation} onChange={(event) => setAttestation(event.target.checked)} />
          <span className="st-checkbox" aria-hidden="true">{attestation && <Check size={13} />}</span>
          <span>
            <strong>I reviewed this plan and take clinical responsibility for publishing it.</strong>
            <small>The version is immutable. The previous published strategy, if any, is archived.</small>
          </span>
        </label>

        {error && <div className="st-form-error" role="alert"><AlertCircle size={14} /> {error}</div>}
      </div>
      <div className="st-modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Not yet</button>
        <button type="button" className="primary-button" onClick={() => void onPublish(attestation, note)} disabled={!ready || publishing}>
          {publishing ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
          {publishing ? 'Publishing…' : 'Publish & lock version'}
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ superfood */

export function SuperfoodModal({
  open,
  reference,
  existing,
  onAdd,
  onClose
}: {
  open: boolean
  reference: Reference
  existing: string[]
  onAdd: (row: { name: string; category: string; panel: string; points: number; source: string; recommendation: string }) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [customRecommendation, setCustomRecommendation] = useState('')

  if (!open) return null
  const needle = query.trim().toLowerCase()
  const items = reference.superfoods.filter((item) =>
    !needle || [item.name, item.category, item.panel, item.recommendation].some((value) => value.toLowerCase().includes(needle))
  )

  function addCustom() {
    if (!customName.trim()) return
    onAdd({
      name: customName.trim(),
      category: customCategory.trim() || 'Manual',
      panel: 'Manual',
      points: 1,
      source: 'Manual entry',
      recommendation: customRecommendation.trim()
    })
    setCustomName('')
    setCustomCategory('')
    setCustomRecommendation('')
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="superfood-title" className="st-modal-wide">
      <div className="st-modal-head">
        <div>
          <span className="st-eyebrow">Practice library</span>
          <h2 id="superfood-title">Add a superfood</h2>
          <p>Pick a practice favourite with a ready-made recommendation, or add your own.</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <div className="st-modal-body">
        <label className="st-search-field">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search paneer, flax, fibre…" aria-label="Search superfoods" autoFocus />
        </label>

        <div className="st-superfood-grid">
          {items.map((item) => {
            const added = existing.includes(item.name)
            return (
              <article className={added ? 'st-superfood-card added' : 'st-superfood-card'} key={item.name}>
                <div className="st-superfood-card-head">
                  <div><strong>{item.name}</strong><small>{item.category} · {item.panel}</small></div>
                  <span className="st-points">{item.points} pt</span>
                </div>
                <p>{item.recommendation}</p>
                <button
                  type="button"
                  className={added ? 'secondary-button compact' : 'primary-button compact'}
                  onClick={() => onAdd({ ...item, source: 'Practice library' })}
                  disabled={added}
                >
                  {added ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                </button>
              </article>
            )
          })}
        </div>

        <div className="st-custom-block">
          <h3>Custom superfood</h3>
          <div className="st-grid st-grid-3">
            <label className="st-field"><span className="st-label">Name</span><input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Sattu" /></label>
            <label className="st-field"><span className="st-label">Category</span><input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="e.g. Legumes" /></label>
            <label className="st-field"><span className="st-label">Points</span><input value="1" readOnly aria-label="Custom points" /></label>
          </div>
          <label className="st-field"><span className="st-label">Recommendation</span><textarea rows={2} value={customRecommendation} onChange={(event) => setCustomRecommendation(event.target.value)} placeholder="Why this food belongs on the plan" /></label>
          <button type="button" className="secondary-button" onClick={addCustom} disabled={!customName.trim()}><Plus size={14} /> Add custom</button>
        </div>
      </div>
      <div className="st-modal-actions">
        <span className="st-modal-count">{existing.length} superfood{existing.length === 1 ? '' : 's'} selected</span>
        <button type="button" className="primary-button" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ preview */

export function PreviewModal({
  open,
  detail,
  onClose
}: {
  open: boolean
  detail: StrategyDetail
  onClose: () => void
}) {
  if (!open) return null
  const data = detail.strategy.data
  const derived = detail.derived
  const status = detail.strategy.status
  return (
    <Modal open={open} onClose={onClose} labelledBy="preview-title" className="st-modal-doc">
      <div className="st-preview-bar">
        <div>
          <span className="st-eyebrow">Client plan</span>
          <h2 id="preview-title">Strategy preview</h2>
        </div>
        <div className="st-preview-actions">
          <button type="button" className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Print / PDF</button>
          <ModalClose onClose={onClose} />
        </div>
      </div>

      <div className="st-plan-doc">
        <header className="st-plan-head">
          <div className="st-plan-brand"><span className="st-plan-mark">N</span><span>NutriAlign</span></div>
          <span className={`st-plan-status ${status}`}>{status === 'published' ? `Published v${detail.strategy.version}` : 'Draft preview'}</span>
          <h1>{data.meta.name || 'Nutrition strategy'}</h1>
          <p>{detail.client.name} · {data.meta.diet_type} · {data.meta.patient_type} · {data.meta.major_goal}</p>
          <div className="st-plan-meta">
            <span>Prepared {formatShortDate(detail.strategy.updated_at)}</span>
            <span>Delivery {formatDateTime(data.meta.delivery_at)}</span>
            <span>Blood report {formatDateTime(data.meta.blood_report_at)}</span>
          </div>
        </header>

        {data.meta.description && <p className="st-plan-description">{data.meta.description}</p>}

        <section className="st-plan-section">
          <h2>Targets</h2>
          <div className="st-plan-stats">
            <div><span>Calories</span><strong>{derived.calories.calories ? derived.calories.calories.toLocaleString() : '—'} kcal</strong></div>
            <div><span>Protein</span><strong>{derived.protein.range} g/kg</strong><small>{derived.protein.min_g}–{derived.protein.max_g} g/day</small></div>
            <div><span>Current → target</span><strong>{data.body.weight_kg} → {data.body.target_weight_kg} kg</strong></div>
            <div><span>BMI</span><strong>{derived.bmi} → {derived.target_bmi}</strong></div>
          </div>
          <p className="st-plan-note">{derived.calories.note}</p>
        </section>

        <section className="st-plan-section">
          <h2>Macro week</h2>
          <table className="st-plan-table">
            <thead><tr><th>Day</th><th>Calories</th><th>CHO</th><th>Protein</th><th>Fat</th><th>Ratio</th></tr></thead>
            <tbody>
              {derived.week.map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td>
                  <td>{day.calories.toLocaleString()}</td>
                  <td>{day.breakdown.grams.cho} g</td>
                  <td>{day.breakdown.grams.pro} g</td>
                  <td>{day.breakdown.grams.fat} g</td>
                  <td>{day.ratio.cho}/{day.ratio.pro}/{day.ratio.fat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="st-plan-section st-plan-columns">
          <div>
            <h2>Food strategy</h2>
            <ul>{data.food.food_wise.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Next phase</h3>
            <ul>{data.food.next_phase.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h2>Superfoods</h2>
            {data.food.superfoods.length ? (
              <ul>{data.food.superfoods.map((item) => <li key={item.name}><strong>{item.name}</strong> — {item.recommendation}</li>)}</ul>
            ) : <p className="st-plan-note">No superfoods selected.</p>}
          </div>
        </section>

        {(data.supplements.length > 0 || data.medications.current.length > 0) && (
          <section className="st-plan-section st-plan-columns">
            <div>
              <h2>Supplements</h2>
              {data.supplements.length ? (
                <ul>{data.supplements.map((item) => <li key={item.name}>{item.name} — {item.quantity} {item.unit}</li>)}</ul>
              ) : <p className="st-plan-note">None.</p>}
            </div>
            <div>
              <h2>Medications reviewed</h2>
              {data.medications.current.length ? (
                <ul>{data.medications.current.map((item) => <li key={`${item.name}-${item.time}`}>{item.name} {item.dosage_per ? `· ${item.dosage_per}` : ''} {item.time ? `· ${item.time}` : ''}</li>)}</ul>
              ) : <p className="st-plan-note">None.</p>}
            </div>
          </section>
        )}

        {derived.interactions.length > 0 && (
          <section className="st-plan-section st-plan-alert">
            <h2><Sparkles size={14} /> Interaction notes</h2>
            <ul>{derived.interactions.map((item) => <li key={item.label}><strong>{item.label}:</strong> {item.recommendation}</li>)}</ul>
          </section>
        )}

        <section className="st-plan-section">
          <h2>Notes</h2>
          <p>{data.notes.client_request || 'No particular request recorded.'}</p>
          {data.notes.other && <p>{data.notes.other}</p>}
          <div className="st-plan-recommendations">
            <span>Weight: {data.recommendations.weight}</span>
            <span>Medical: {data.recommendations.medical}</span>
            <span>Symptoms: {data.recommendations.symptoms}</span>
            <span>Immunity: {data.recommendations.immunity}</span>
          </div>
        </section>

        <footer className="st-plan-foot">
          <p>This plan is a clinical strategy, not medical advice. Follow the treating clinician's guidance and seek care for new or worsening symptoms.</p>
          <span>{detail.client.name} · {formatShortDate(detail.strategy.updated_at)} · NutriAlign</span>
        </footer>
      </div>
      <div className="st-preview-foot">
        <span>Printing uses the browser dialog. Choose “Save as PDF” for a client-ready copy.</span>
        <button type="button" className="primary-button" onClick={() => window.print()}><Printer size={15} /> Print / PDF</button>
      </div>
    </Modal>
  )
}
