import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Flame,
  HeartPulse,
  Info,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils
} from 'lucide-react'
import { Toast } from '../clients/ui'
import { ApiError, createRevision, getStrategy, publishStrategy, refreshStrategy, updateStrategy } from './api'
import { BriefSection, ClinicalSection, FoodSection, MacrosSection, ReviewSection, SupportSection, TargetsSection } from './StrategySections'
import { FormulaModal, MacroDayModal, PreviewModal, PublishModal, RdaModal, SuperfoodModal } from './StrategyModals'
import { MacroBar, Ring, StatusPill } from './StrategyUI'
import type {
  MacroDay,
  SectionId,
  StrategyData,
  StrategyDetail
} from './types'
import { formatShortDate, initials, relativeTime, replaceDay, setByPath } from './utils'
import './strategy.css'

const SECTIONS: { id: SectionId; num: string; label: string; hint: string; icon: typeof Target }[] = [
  { id: 'brief', num: '01', label: 'Brief', hint: 'Identity and dates', icon: ClipboardCheck },
  { id: 'clinical', num: '02', label: 'Clinical context', hint: 'Goals, labs, flags', icon: HeartPulse },
  { id: 'targets', num: '03', label: 'Targets', hint: 'Energy and protein', icon: Target },
  { id: 'macros', num: '04', label: 'Macro week', hint: 'Seven-day math', icon: Activity },
  { id: 'food', num: '05', label: 'Food strategy', hint: 'Patterns and foods', icon: Utensils },
  { id: 'support', num: '06', label: 'Supplements & meds', hint: 'Interactions', icon: Sparkles },
  { id: 'review', num: '07', label: 'Review & publish', hint: 'Sign-off gate', icon: ShieldCheck }
]

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export default function StrategyStudio({
  clientId,
  strategyId,
  onBack
}: {
  clientId: string
  strategyId: string
  onBack: () => void
}) {
  const [detail, setDetail] = useState<StrategyDetail | null>(null)
  const [data, setData] = useState<StrategyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('brief')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [lastSaved, setLastSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<'rda' | 'formula' | 'publish' | 'superfood' | 'preview' | null>(null)
  const [editingDay, setEditingDay] = useState<MacroDay | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const chain = useRef<Promise<void>>(Promise.resolve())
  const editSeq = useRef(0)
  const lastQueued = useRef<StrategyData | null>(null)
  const saveErrorRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetail(null)
    setData(null)
    setLoadError('')
    getStrategy(clientId, strategyId)
      .then((result) => {
        if (cancelled) return
        setDetail(result)
        setData(result.strategy.data)
        lastQueued.current = result.strategy.data
        setSaveState('saved')
        setLastSaved(result.strategy.updated_at)
        setActiveSection('brief')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Unable to load this strategy')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, strategyId])

  const locked = detail?.strategy.status !== 'draft'

  function update(path: (string | number)[], value: unknown) {
    setData((current) => {
      if (!current) return current
      editSeq.current += 1
      setSaveState('dirty')
      setToast('')
      return setByPath(current, path, value)
    })
  }

  function persist(next: StrategyData): Promise<void> {
    const seq = editSeq.current
    saveErrorRef.current = false
    setSaving(true)
    setSaveState('saving')
    chain.current = chain.current.then(async () => {
      try {
        const result = await updateStrategy(clientId, strategyId, { data: next })
        setDetail((current) => current ? {
          ...current,
          strategy: {
            ...current.strategy,
            updated_at: result.strategy.updated_at,
            version: result.strategy.version,
            status: result.strategy.status
          },
          derived: result.derived,
          readiness: result.readiness
        } : current)
        if (seq === editSeq.current) {
          setSaveState('saved')
          setLastSaved(result.strategy.updated_at)
        }
      } catch (err) {
        saveErrorRef.current = true
        setSaveState('error')
        setToast(err instanceof ApiError ? err.message : 'Unable to save this strategy')
      } finally {
        setSaving(false)
      }
    })
    return chain.current
  }

  useEffect(() => {
    if (!data || !detail || locked) return
    if (lastQueued.current === data) return
    lastQueued.current = data
    const timer = window.setTimeout(() => { void persist(data) }, 850)
    return () => window.clearTimeout(timer)
    // persist is intentionally stable enough for this debounce window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, detail, locked])

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState !== 'dirty' && saveState !== 'error') return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveState])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (data && detail && !locked) void persist(data)
      }
      if (event.key === 'Escape') {
        setEditingDay(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [data, detail, locked])

  function go(section: SectionId) {
    setActiveSection(section)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (window.scrollY > 160) window.scrollTo({ top: 120, behavior: reduce ? 'auto' : 'smooth' })
  }

  async function refresh(scope: 'clinical' | 'body' | 'support' | 'all') {
    if (!detail) return
    if ((saveState === 'dirty' || saveState === 'error') && data) {
      const proceed = window.confirm('Sync from the client record? Your unsaved local edits in this draft will be replaced.')
      if (!proceed) return
    }
    setRefreshing(scope)
    try {
      const result = await refreshStrategy(clientId, strategyId, scope)
      setDetail(result)
      setData(result.strategy.data)
      lastQueued.current = result.strategy.data
      editSeq.current += 1
      setSaveState('saved')
      setLastSaved(result.strategy.updated_at)
      setToast('Synced from the client record')
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Unable to sync from the record')
    } finally {
      setRefreshing('')
    }
  }

  async function openPublish() {
    if (!data) return
    if (saveState === 'saving') {
      await chain.current
      if (saveErrorRef.current) {
        setToast('The draft could not be saved. Fix the save error before publishing.')
        return
      }
    }
    if (saveState === 'dirty' || saveState === 'error') {
      await persist(data)
      if (saveErrorRef.current) {
        setToast('The draft could not be saved. Fix the save error before publishing.')
        return
      }
    }
    setPublishError('')
    setModal('publish')
  }

  async function openRecord(tab: string) {
    if (saveState === 'saving') await chain.current
    if (data && (saveState === 'dirty' || saveState === 'error')) {
      await persist(data)
      if (saveErrorRef.current) return
    }
    window.location.hash = `clients/${clientId}?tab=${tab}`
  }

  function storedDay(day: MacroDay): MacroDay {
    return {
      day: day.day,
      formula: day.formula,
      calories: day.calories,
      protein_target: day.protein_target,
      ratio: { cho: day.ratio.cho, pro: day.ratio.pro, fat: day.ratio.fat },
      note: day.note,
      active: day.active
    }
  }

  function saveDay(day: MacroDay) {
    if (!data) return
    const next = storedDay(day)
    update(['macros', 'days'], replaceDay(data, next).macros.days)
    setEditingDay(null)
    setToast(`${day.day} updated`)
  }

  function saveToDays(day: MacroDay, target: 'all' | 'weekdays' | 'weekend') {
    if (!data) return
    const next = storedDay(day)
    const names = target === 'all' ? null : target === 'weekdays' ? new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) : new Set(['Saturday', 'Sunday'])
    update(['macros', 'days'], data.macros.days.map((item) => ({
      ...(names && !names.has(item.day) ? item : next),
      day: item.day,
      active: item.active
    })))
    setEditingDay(null)
    setToast(target === 'all' ? 'Macro split applied to all seven days' : target === 'weekdays' ? 'Macro split applied to weekdays' : 'Macro split applied to the weekend')
  }

  function addSuperfood(row: { name: string; category: string; panel: string; points: number; source: string; recommendation: string }) {
    if (!data) return
    if (data.food.superfoods.some((item) => item.name.toLowerCase() === row.name.toLowerCase())) return
    update(['food', 'superfoods'], [
      ...data.food.superfoods,
      {
        name: row.name,
        category: row.category,
        panel: row.panel,
        points: row.points,
        source: row.source,
        recommendation: row.recommendation
      }
    ])
  }

  async function publish(attestation: boolean, note: string) {
    setPublishing(true)
    setPublishError('')
    try {
      const result = await publishStrategy(clientId, strategyId, { attestation, note })
      setDetail(result)
      setData(result.strategy.data)
      lastQueued.current = result.strategy.data
      setModal(null)
      setActiveSection('review')
      setToast(`Strategy published as v${result.strategy.version}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to publish this strategy'
      setPublishError(
        err instanceof ApiError && err.blockers.length
          ? `${message}. ${err.blockers.map((item) => item.label).join(', ')}.`
          : message
      )
      try {
        const fresh = await getStrategy(clientId, strategyId)
        setDetail(fresh)
      } catch {
        // Keep the current view; the error message still explains the failure.
      }
    } finally {
      setPublishing(false)
    }
  }

  async function revise() {
    if (!detail) return
    try {
      const result = await createRevision(clientId, detail.strategy.id)
      window.location.hash = `clients/${clientId}/strategy/${result.strategy.id}`
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Unable to create a revision')
    }
  }

  if (loading) {
    return (
      <main className="studio-page studio-loading" aria-busy="true" aria-label="Loading strategy studio">
        <div className="studio-skeleton-head">
          <span className="cf-skeleton sk-line" style={{ width: 160 }} />
          <span className="cf-skeleton sk-line tall" style={{ width: 360 }} />
          <span className="cf-skeleton sk-line" style={{ width: 260 }} />
        </div>
        <div className="studio-skeleton-grid">
          <span className="cf-skeleton sk-block" />
          <span className="cf-skeleton sk-block tall" />
          <span className="cf-skeleton sk-block" />
        </div>
      </main>
    )
  }

  if (!detail || !data) {
    return (
      <main className="studio-page">
        <button className="cf-back" onClick={onBack}><ArrowLeft size={16} /> Back to client</button>
        <div className="st-load-error">
          <span className="clients-empty-icon"><AlertCircle size={26} /></span>
          <h1>Strategy not available</h1>
          <p>{loadError || 'This strategy may have been removed.'}</p>
          <button className="secondary-button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    )
  }

  const derived = detail.derived
  const readiness = derived.readiness
  const meta = data.meta
  const completion: Record<SectionId, boolean> = {
    brief: Boolean(meta.name && meta.diet_type && meta.patient_type && meta.major_goal && meta.delivery_at),
    clinical: data.clinical.goals.length > 0,
    targets: Boolean(data.body.height_cm && data.body.weight_kg && data.body.target_weight_kg),
    macros: derived.totals.days_complete === 7,
    food: data.food.food_wise.length > 0,
    support: derived.interactions.length === 0 || Boolean(data.governance.acknowledged_interactions),
    review: readiness.can_publish || detail.strategy.status === 'published'
  }
  const currentSection = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0]
  const saveLabel = saveState === 'saving'
    ? 'Saving…'
    : saveState === 'dirty'
      ? 'Unsaved changes'
      : saveState === 'error'
        ? 'Could not save'
        : lastSaved
          ? `Saved ${relativeTime(lastSaved)}`
          : 'All changes saved'

  const sectionProps = {
    data,
    detail,
    reference: detail.reference,
    derived,
    locked,
    update,
    onJump: go,
    onRefresh: refresh,
    refreshing,
    onOpenFormula: () => setModal('formula'),
    onOpenRda: () => setModal('rda'),
    onOpenRecord: (tab: string) => { void openRecord(tab) },
    onEditDay: (day: MacroDay) => setEditingDay(day),
    onAddSuperfood: () => setModal('superfood'),
    onPublish: () => { void openPublish() },
    onPreview: () => setModal('preview'),
    onSave: () => { if (data) void persist(data) },
    saving,
    dirty: saveState === 'dirty' || saveState === 'error'
  }

  return (
    <main className="studio-page">
      <div className="studio-command">
        <div className="studio-command-left">
          <button type="button" className="cf-back" onClick={onBack} aria-label="Back to client record">
            <ArrowLeft size={16} /> <span className="st-back-label">Client record</span>
          </button>
          <span className="studio-breadcrumb">
            <span>{detail.client.name}</span>
            <i aria-hidden="true">/</i>
            <span>Strategy</span>
          </span>
        </div>
        <div className="studio-command-right">
          <span className={`st-save-state ${saveState}`} role="status" aria-live="polite">
            {saveState === 'saving' ? <Loader2 size={13} className="spin" /> : saveState === 'saved' ? <Check size={13} /> : <span className="st-save-dot" />}
            {saveLabel}
          </span>
          <button type="button" className="secondary-button compact" onClick={() => setModal('preview')}><Eye size={15} /> Preview</button>
          {detail.strategy.status === 'draft' && (
            <button type="button" className="primary-button compact" onClick={() => void openPublish()}><ShieldCheck size={15} /> Publish</button>
          )}
          {detail.strategy.status === 'published' && (
            <button type="button" className="primary-button compact" onClick={() => void revise()}><RefreshCw size={15} /> Create revision</button>
          )}
          {detail.strategy.status === 'archived' && (
            <span className="st-archived-chip"><ShieldCheck size={13} /> Archived version</span>
          )}
        </div>
      </div>

      <header className="studio-hero">
        <span className="studio-avatar" aria-hidden="true">{initials(detail.client.name)}</span>
        <div className="studio-hero-copy">
          <span className="st-eyebrow">Strategy studio · {detail.client.name}</span>
          <h1>{meta.name.trim() || 'Untitled strategy'}</h1>
          <p>
            {[meta.diet_type, meta.patient_type, meta.major_goal].filter(Boolean).join(' · ')}
            {meta.delivery_at ? ` · delivery ${formatShortDate(meta.delivery_at)}` : ''}
          </p>
        </div>
        <div className="studio-hero-meta">
          <StatusPill status={detail.strategy.status} version={detail.strategy.version} />
          <span>Updated {relativeTime(detail.strategy.updated_at)}</span>
          <span className="st-hero-readiness"><Ring value={readiness.score} size={40} /> {readiness.score}% ready</span>
        </div>
      </header>

      {detail.strategy.status === 'archived' && (
        <div className="st-archived-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>Archived v{detail.strategy.version}</strong>
            <p>This plan has been superseded. Open the current published strategy to make changes.</p>
          </div>
          <button type="button" className="secondary-button compact" onClick={onBack}>Back to strategy history</button>
        </div>
      )}

      {detail.strategy.status === 'published' && (
        <div className="st-published-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>Published v{detail.strategy.version} on {formatShortDate(detail.strategy.published_at)}</strong>
            <p>This version is locked for clinical integrity. Create a revision to change targets, macros, or food strategy.</p>
          </div>
          <button type="button" className="secondary-button compact" onClick={() => void revise()}><RefreshCw size={14} /> Revision</button>
        </div>
      )}

      <div className="studio-grid">
        <aside className="studio-rail-wrap">
          <nav className="studio-rail" aria-label="Strategy sections">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const active = section.id === activeSection
              const done = completion[section.id]
              return (
                <button
                  type="button"
                  key={section.id}
                  className={`st-rail-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => go(section.id)}
                >
                  <span className="st-rail-num">{done ? <Check size={12} /> : section.num}</span>
                  <span className="st-rail-copy"><strong>{section.label}</strong><small>{section.hint}</small></span>
                  <Icon size={15} className="st-rail-icon" />
                </button>
              )
            })}
            <div className="st-rail-foot">
              <div className="st-rail-progress"><span style={{ width: `${readiness.score}%` }} /></div>
              <small>{readiness.required_passed} of {readiness.required_total} checks</small>
              <button type="button" className="st-link" onClick={() => go('review')}>Open publish checklist</button>
            </div>
          </nav>
        </aside>

        <div className="studio-content">
          {activeSection === 'brief' && <BriefSection {...sectionProps} />}
          {activeSection === 'clinical' && <ClinicalSection {...sectionProps} />}
          {activeSection === 'targets' && <TargetsSection {...sectionProps} />}
          {activeSection === 'macros' && <MacrosSection {...sectionProps} />}
          {activeSection === 'food' && <FoodSection {...sectionProps} />}
          {activeSection === 'support' && <SupportSection {...sectionProps} />}
          {activeSection === 'review' && <ReviewSection {...sectionProps} />}

          <div className="st-section-pager">
            {SECTIONS.findIndex((section) => section.id === activeSection) > 0 && (
              <button type="button" className="secondary-button" onClick={() => go(SECTIONS[SECTIONS.findIndex((section) => section.id === activeSection) - 1].id)}>
                <ArrowLeft size={15} /> Previous
              </button>
            )}
            {SECTIONS.findIndex((section) => section.id === activeSection) < SECTIONS.length - 1 && (
              <button type="button" className="primary-button" onClick={() => go(SECTIONS[SECTIONS.findIndex((section) => section.id === activeSection) + 1].id)}>
                Next: {SECTIONS[SECTIONS.findIndex((section) => section.id === activeSection) + 1].label}
              </button>
            )}
          </div>
        </div>

        <aside className="studio-side">
          <div className="st-side-card target">
            <div className="st-side-head">
              <span className="st-eyebrow"><Flame size={12} /> Live targets</span>
              <button type="button" className="st-link" onClick={() => setModal('formula')}><Calculator size={12} /> Formula</button>
            </div>
            <div className="st-side-calories">
              <strong>{derived.calories.calories ? derived.calories.calories.toLocaleString() : '—'}</strong>
              <span>kcal / day</span>
            </div>
            <MacroBar cho={derived.totals.avg_cho * 4} pro={derived.totals.avg_protein * 4} fat={derived.totals.avg_fat * 9} />
            <div className="st-side-macro-labels">
              <span><i className="cho" /> C {derived.totals.avg_cho}g</span>
              <span><i className="pro" /> P {derived.totals.avg_protein}g</span>
              <span><i className="fat" /> F {derived.totals.avg_fat}g</span>
            </div>
            <div className="st-side-facts">
              <div><span>Protein</span><strong>{derived.protein.range}</strong><small>g/kg target</small></div>
              <div><span>BMI</span><strong>{derived.bmi || '—'}</strong><small>{derived.bmi_category}</small></div>
              <div><span>Week</span><strong>{derived.totals.days_complete}/7</strong><small>days built</small></div>
            </div>
            <p className="st-side-note">{derived.calories.note}</p>
          </div>

          <div className="st-side-card readiness">
            <div className="st-side-readiness">
              <Ring value={readiness.score} size={54} />
              <div><span className="st-eyebrow">Publish readiness</span><strong>{detail.strategy.status === 'published' ? 'Signed & locked' : detail.strategy.status === 'archived' ? 'Archived version' : readiness.can_publish ? 'Ready to publish' : `${readiness.blockers.length} open item${readiness.blockers.length === 1 ? '' : 's'}`}</strong></div>
            </div>
            {readiness.blockers.length > 0 ? (
              <ul className="st-side-blockers">
                {readiness.blockers.slice(0, 3).map((blocker) => (
                  <li key={blocker.id}>
                    <button type="button" onClick={() => go(blocker.section)}>
                      <span>{blocker.label}</span>
                      <ArrowLeft size={12} className="st-blocker-arrow" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="st-side-ready"><CheckCircle2 size={14} /> All checks pass.</p>
            )}
            <button type="button" className="secondary-button compact" onClick={() => go('review')}>Review checklist</button>
          </div>

          <div className="st-side-card guardrails">
            <span className="st-eyebrow"><HeartPulse size={12} /> Guardrails</span>
            <div className="st-side-tags">
              <span>{detail.context.diet || meta.diet_type}</span>
              {detail.context.allergies.map((item) => <span className="danger" key={item}>{item}</span>)}
              {detail.context.intolerances.map((item) => <span className="warn" key={item}>{item}</span>)}
            </div>
            {derived.interactions.length > 0 && (
              data.governance.acknowledged_interactions ? (
                <p className="st-side-reviewed"><CheckCircle2 size={14} /> {derived.interactions.length} interaction{derived.interactions.length === 1 ? '' : 's'} reviewed</p>
              ) : (
                <button type="button" className="st-side-alert" onClick={() => go('support')}>
                  <AlertCircle size={14} /> {derived.interactions.length} interaction{derived.interactions.length === 1 ? '' : 's'} to review
                </button>
              )
            )}
            {derived.conflicts.length > 0 && (
              data.governance.acknowledged_allergies ? (
                <p className="st-side-reviewed"><CheckCircle2 size={14} /> {derived.conflicts.length} food conflict{derived.conflicts.length === 1 ? '' : 's'} reviewed</p>
              ) : (
                <button type="button" className="st-side-alert" onClick={() => go('food')}>
                  <AlertCircle size={14} /> {derived.conflicts.length} food conflict{derived.conflicts.length === 1 ? '' : 's'}
                </button>
              )
            )}
          </div>

          <p className="st-side-foot"><Info size={12} /> Autosaved locally. Cmd/Ctrl + S saves immediately.</p>
        </aside>
      </div>

      <div className="studio-mobile-bar">
        <div><Ring value={readiness.score} size={36} /><span>{readiness.can_publish ? 'Ready' : `${readiness.blockers.length} open`}</span></div>
        <button type="button" className="secondary-button compact" onClick={() => { if (data) void persist(data) }} disabled={saving || !sectionProps.dirty}><Save size={15} /> Save</button>
        <button type="button" className="primary-button compact" onClick={() => void openPublish()}><ShieldCheck size={15} /> Publish</button>
      </div>

      <MacroDayModal
        open={Boolean(editingDay)}
        day={editingDay}
        reference={detail.reference}
        targetWeight={data.body.target_weight_kg}
        onClose={() => setEditingDay(null)}
        onSave={saveDay}
        onSaveTo={saveToDays}
      />
      <RdaModal open={modal === 'rda'} reference={detail.reference} detail={detail} onClose={() => setModal(null)} />
      <FormulaModal open={modal === 'formula'} reference={detail.reference} onClose={() => setModal(null)} />
      <PublishModal
        open={modal === 'publish'}
        detail={detail}
        onClose={() => setModal(null)}
        onJump={(section) => go(section as SectionId)}
        onPublish={publish}
        publishing={publishing}
        error={publishError}
      />
      <SuperfoodModal
        open={modal === 'superfood'}
        reference={detail.reference}
        existing={data.food.superfoods.map((item) => item.name)}
        onAdd={addSuperfood}
        onClose={() => setModal(null)}
      />
      <PreviewModal open={modal === 'preview'} detail={detail} onClose={() => setModal(null)} />
      <Toast message={toast} onDone={() => setToast('')} />
    </main>
  )
}
