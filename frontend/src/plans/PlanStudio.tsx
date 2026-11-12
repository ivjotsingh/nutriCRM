import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils
} from 'lucide-react'
import { Toast } from '../clients/ui'
import { Ring, StatusPill } from '../strategy/StrategyUI'
import { ApiError, createPlanRevision, getCatalog, getPlan, planPdfUrl, publishPlan, updatePlan } from './api'
import type { Dish, PlanData, PlanDetail, PlanSectionId } from './types'
import DayBoard from './DayBoard'
import { DetailsSection, GuidelinesSection, LibrarySection, ReviewSection, TargetsSection } from './PlanSections'
import { planTotals, relativeTime } from './utils'
import './plans.css'

const SECTIONS: { id: PlanSectionId; num: string; label: string; hint: string; icon: typeof Target }[] = [
  { id: 'details', num: '01', label: 'Details', hint: 'Dates, weight, branding', icon: CalendarDays },
  { id: 'targets', num: '02', label: 'Targets', hint: 'Energy and macros', icon: Target },
  { id: 'week', num: '03', label: 'Week plan', hint: 'Seven days of meals', icon: Utensils },
  { id: 'library', num: '04', label: 'Recommendations', hint: 'Superfoods and notes', icon: Sparkles },
  { id: 'guidelines', num: '05', label: 'Guidelines', hint: 'Printed guidance', icon: FileText },
  { id: 'preview', num: '06', label: 'Preview', hint: 'The final PDF', icon: Eye },
  { id: 'review', num: '07', label: 'Review & publish', hint: 'Sign-off gate', icon: ShieldCheck }
]

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export default function PlanStudio({
  clientId,
  planId,
  onBack
}: {
  clientId: string
  planId: string
  onBack: () => void
}) {
  const [detail, setDetail] = useState<PlanDetail | null>(null)
  const [data, setData] = useState<PlanData | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [section, setSection] = useState<PlanSectionId>('week')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [lastSaved, setLastSaved] = useState('')
  const [toast, setToast] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [previewKey, setPreviewKey] = useState(Date.now())

  const chain = useRef<Promise<void>>(Promise.resolve())
  const editSeq = useRef(0)
  const saveErrorRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    Promise.all([getPlan(clientId, planId), getCatalog()])
      .then(([result, catalogue]) => {
        if (cancelled) return
        setDetail(result)
        setData(result.plan.data)
        setDishes(catalogue.dishes)
        setSaveState('saved')
        setLastSaved(result.plan.updated_at)
        setSection('week')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Unable to load this plan')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, planId])

  const locked = detail?.plan.status !== 'draft'

  function update(path: (string | number)[], value: unknown) {
    setData((current) => {
      if (!current) return current
      const next = setDeep(current, path, value)
      editSeq.current += 1
      setSaveState('dirty')
      setToast('')
      void persist(next)
      return next
    })
  }

  function persist(next: PlanData): Promise<void> {
    const seq = editSeq.current
    saveErrorRef.current = false
    setSaveState('saving')
    chain.current = chain.current.then(async () => {
      try {
        const result = await updatePlan(clientId, planId, { data: next })
        setDetail((current) =>
          current
            ? {
                ...current,
                plan: { ...current.plan, updated_at: result.plan.updated_at, status: result.plan.status, version: result.plan.version },
                derived: result.derived,
                readiness: result.readiness
              }
            : current
        )
        if (seq === editSeq.current) {
          setSaveState('saved')
          setLastSaved(result.plan.updated_at)
        }
      } catch (err) {
        saveErrorRef.current = true
        setSaveState('error')
        setToast(err instanceof Error ? err.message : 'Unable to save the plan')
      }
    })
    return chain.current
  }

  async function forceSave() {
    if (!data) return
    await persist(data)
    setPreviewKey(Date.now())
  }

  async function publish(attestation: boolean, note: string) {
    if (!data) return
    setPublishing(true)
    try {
      await persist(data)
      const result = await publishPlan(clientId, planId, { attestation, note })
      setDetail(result)
      setData(result.plan.data)
      setToast(`Plan published as v${result.plan.version}`)
      setSection('preview')
      setPreviewKey(Date.now())
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to publish this plan'
      setToast(err instanceof ApiError && err.blockers.length ? `${message}: ${err.blockers.map((item) => item.label).join(', ')}` : message)
    } finally {
      setPublishing(false)
    }
  }

  async function revise() {
    if (!detail) return
    try {
      const result = await createPlanRevision(clientId, detail.plan.id)
      window.location.hash = `clients/${clientId}/plan/${result.plan.id}`
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Unable to create a revision')
    }
  }

  if (loading) {
    return (
      <main className="studio-page studio-loading" aria-busy="true" aria-label="Loading the plan studio">
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
          <h1>Plan not available</h1>
          <p>{loadError || 'This plan may have been removed.'}</p>
          <button className="secondary-button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    )
  }

  const readiness = detail.readiness
  const totals = planTotals(data)
  const index = SECTIONS.findIndex((item) => item.id === section)
  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved changes' : saveState === 'error' ? 'Could not save' : lastSaved ? `Saved ${relativeTime(lastSaved)}` : 'All changes saved'

  const shared = {
    data,
    detail,
    reference: detail.reference,
    derived: detail.derived,
    locked,
    update,
    onJump: (target: string) => setSection((target === 'extras' ? 'library' : target) as PlanSectionId),
    onToast: setToast
  }

  return (
    <main className="studio-page pl-studio">
      <div className="studio-command">
        <div className="studio-command-left">
          <button type="button" className="cf-back" onClick={onBack} aria-label="Back to client record">
            <ArrowLeft size={16} /> <span className="st-back-label">Client record</span>
          </button>
          <span className="studio-breadcrumb">
            <span>{detail.client.name}</span>
            <i aria-hidden="true">/</i>
            <span>Diet plan</span>
          </span>
        </div>
        <div className="studio-command-right">
          <span className={`st-save-state ${saveState}`} role="status" aria-live="polite">
            {saveState === 'saving' ? <Loader2 size={13} className="spin" /> : saveState === 'saved' ? <Check size={13} /> : <span className="st-save-dot" />}
            {saveLabel}
          </span>
          <button type="button" className="secondary-button compact" onClick={() => { void forceSave(); setSection('preview') }}>
            <Eye size={15} /> Preview
          </button>
          <a className="secondary-button compact" href={planPdfUrl(clientId, planId, { download: true })}>
            <Download size={15} /> PDF
          </a>
          {detail.plan.status === 'draft' && (
            <button type="button" className="primary-button compact" onClick={() => setSection('review')}>
              <ShieldCheck size={15} /> Publish
            </button>
          )}
          {detail.plan.status === 'published' && (
            <button type="button" className="primary-button compact" onClick={() => void revise()}>
              <RefreshCw size={15} /> Create revision
            </button>
          )}
        </div>
      </div>

      <header className="studio-hero">
        <span className="studio-avatar" aria-hidden="true">{initialsOf(detail.client.name)}</span>
        <div className="studio-hero-copy">
          <span className="st-eyebrow">Plan studio · {detail.client.name}</span>
          <h1>{data.meta.title || 'Untitled plan'}</h1>
          <p>
            {[data.meta.diet_type, `${data.meta.duration_days} days`, `${totals.meals} dishes`, `${totals.calories.toLocaleString()} kcal/day`].join(' · ')}
          </p>
        </div>
        <div className="studio-hero-meta">
          <StatusPill status={detail.plan.status} version={detail.plan.version} />
          <span>Updated {relativeTime(detail.plan.updated_at)}</span>
          <span className="st-hero-readiness"><Ring value={readiness.score} size={40} /> {readiness.score}% ready</span>
        </div>
      </header>

      {detail.plan.status === 'published' && (
        <div className="st-published-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>Published v{detail.plan.version} on {new Date(detail.plan.published_at).toLocaleDateString()}</strong>
            <p>The published plan is locked. Create a revision to change meals, targets or printed sections.</p>
          </div>
          <a className="secondary-button compact" href={planPdfUrl(clientId, planId, { download: true })}><Download size={14} /> Download PDF</a>
        </div>
      )}

      <div className="studio-grid">
        <aside className="studio-rail-wrap">
          <nav className="studio-rail" aria-label="Plan sections">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              const active = item.id === section
              const done =
                item.id === 'details'
                  ? Boolean(data.meta.title && data.meta.start_date)
                  : item.id === 'targets'
                    ? Boolean(data.targets.calories && data.targets.protein_g)
                    : item.id === 'week'
                      ? detail.derived.days.every((day) => !day.active || day.meals > 0)
                      : item.id === 'review'
                        ? readiness.ready
                        : false
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`st-rail-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => {
                    if (item.id === 'preview') void forceSave()
                    setSection(item.id)
                  }}
                >
                  <span className="st-rail-num">{done ? <Check size={12} /> : item.num}</span>
                  <span className="st-rail-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
                  <Icon size={15} className="st-rail-icon" />
                </button>
              )
            })}
            <div className="st-rail-foot">
              <div className="st-rail-progress"><span style={{ width: `${readiness.score}%` }} /></div>
              <small>{readiness.checks.filter((check) => check.status === 'pass').length} of {readiness.checks.length} checks</small>
              <button type="button" className="st-link" onClick={() => setSection('review')}>Open publish checklist</button>
            </div>
          </nav>
        </aside>

        <div className="studio-content">
          {section === 'details' && <DetailsSection {...shared} />}
          {section === 'targets' && <TargetsSection {...shared} />}
          {section === 'week' && (
            <DayBoard
              data={data}
              derivedDays={detail.derived.days}
              reference={detail.reference}
              dishes={dishes}
              locked={locked}
              update={update}
              onToast={setToast}
            />
          )}
          {section === 'library' && <LibrarySection {...shared} />}
          {section === 'guidelines' && <GuidelinesSection {...shared} />}
          {section === 'review' && (
            <ReviewSection {...shared} onPublish={(attestation, note) => void publish(attestation, note)} onPreview={() => { void forceSave(); setSection('preview') }} publishing={publishing} />
          )}
          {section === 'preview' && (
            <div className="pl-preview">
              <div className="pl-preview-head">
                <div>
                  <span className="pl-eyebrow"><Eye size={13} /> Preview</span>
                  <h2>The exact PDF your client receives</h2>
                  <p>{detail.plan.status === 'draft' ? 'Draft pages carry a “Draft preview” stamp.' : `Approved version v${detail.plan.version}.`}</p>
                </div>
                <div className="pl-head-actions">
                  <button type="button" className="secondary-button compact" onClick={() => void forceSave().then(() => setPreviewKey(Date.now()))}>
                    <RefreshCw size={14} /> Refresh
                  </button>
                  <a className="primary-button compact" href={planPdfUrl(clientId, planId, { download: true })}>
                    <Download size={15} /> Download PDF
                  </a>
                </div>
              </div>
              <iframe
                key={previewKey}
                className="pl-preview-frame"
                title="Plan PDF preview"
                src={planPdfUrl(clientId, planId)}
              />
            </div>
          )}

          <div className="st-section-pager">
            {index > 0 && (
              <button type="button" className="secondary-button" onClick={() => setSection(SECTIONS[index - 1].id)}>
                <ChevronLeft size={15} /> Previous
              </button>
            )}
            {index < SECTIONS.length - 1 && (
              <button type="button" className="primary-button" onClick={() => setSection(SECTIONS[index + 1].id)}>
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </main>
  )
}

function setDeep<T>(source: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  if (Array.isArray(source)) {
    const copy = source.slice()
    copy[Number(head)] = setDeep(copy[Number(head)], rest, value)
    return copy as unknown as T
  }
  const record = { ...(source as Record<string, unknown>) }
  record[String(head)] = setDeep(record[String(head)], rest, value)
  return record as T
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'N'
  )
}
