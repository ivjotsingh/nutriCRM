import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UtensilsCrossed
} from 'lucide-react'
import { ApiError, createPlan, createPlanRevision, deletePlan, duplicatePlan, listPlans, planPdfUrl } from './api'
import type { PlanSummary } from './types'
import { StatusPill } from '../strategy/StrategyUI'
import { formatShortDate, relativeTime } from './utils'
import './plans.css'

export default function PlanHistory({
  clientId,
  clientName,
  onOpenPlan
}: {
  clientId: string
  clientName: string
  onOpenPlan: (planId: string) => void
}) {
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  function load() {
    setLoading(true)
    listPlans(clientId)
      .then((result) => {
        setPlans(result.plans)
        setTemplates(result.templates)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load diet plans'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [clientId])

  async function create(templateId = '') {
    setBusy('create')
    setError('')
    setMenuOpen(false)
    try {
      const detail = await createPlan(clientId, { template_id: templateId })
      onOpenPlan(detail.plan.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create a plan')
    } finally {
      setBusy('')
    }
  }

  async function remove(planId: string) {
    if (!window.confirm('Delete this draft? Published versions are untouched.')) return
    setBusy(planId)
    try {
      await deletePlan(clientId, planId)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete this draft')
    } finally {
      setBusy('')
    }
  }

  async function revise(planId: string) {
    setBusy(planId)
    try {
      const detail = await createPlanRevision(clientId, planId)
      onOpenPlan(detail.plan.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create a revision')
    } finally {
      setBusy('')
    }
  }

  async function duplicate(planId: string) {
    setBusy(planId)
    try {
      const detail = await duplicatePlan(clientId, planId)
      onOpenPlan(detail.plan.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to duplicate this plan')
    } finally {
      setBusy('')
    }
  }

  const current = plans[0]
  const rest = plans.slice(1)
  const firstName = clientName.split(' ')[0] || 'this client'

  return (
    <div className="pl-history">
      <div className="pl-history-bar">
        <div>
          <span className="pl-eyebrow"><UtensilsCrossed size={13} /> Planning</span>
          <h3>Diet plans</h3>
          <p>Build the seven-day plan, preview the exact PDF, then publish the version {firstName} receives.</p>
        </div>
        <div className="pl-history-actions">
          <div className="pl-menu-wrap">
            <button type="button" className="primary-button" onClick={() => setMenuOpen((value) => !value)} disabled={Boolean(busy)}>
              {busy === 'create' ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
              {busy === 'create' ? 'Building plan…' : 'New plan'}
            </button>
            {menuOpen && (
              <div className="pl-menu pl-menu-right" role="menu">
                <button type="button" role="menuitem" onClick={() => void create('')}>
                  <strong>Blank week</strong>
                  <small>Start from an empty seven-day board</small>
                </button>
                {templates.map((template) => (
                  <button type="button" role="menuitem" key={template.id} onClick={() => void create(template.id)}>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="cf-alert" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" className="st-link" onClick={load}>Try again</button>
        </div>
      )}

      {loading && (
        <div className="st-history-skeleton" aria-busy="true" aria-label="Loading plans">
          <span className="cf-skeleton sk-line" style={{ width: 180 }} />
          <span className="cf-skeleton sk-block" />
          <span className="cf-skeleton sk-line" style={{ width: 260 }} />
        </div>
      )}

      {!loading && plans.length === 0 && (
        <div className="st-history-empty">
          <span className="st-empty-mark" aria-hidden="true"><UtensilsCrossed size={24} /></span>
          <h3>Turn the strategy into the week they actually eat.</h3>
          <p>
            The plan studio carries the energy and protein targets across, then you build each day from the food catalogue.
            The PDF matches the printed plan your clients already know.
          </p>
          <ul>
            <li><CheckCircle2 size={15} /> Seven-day board with meal slots, portions and alternatives</li>
            <li><CheckCircle2 size={15} /> Live calories and macros against the day's target</li>
            <li><CheckCircle2 size={15} /> Preview and download the branded PDF before publishing</li>
          </ul>
          <button type="button" className="primary-button" onClick={() => void create(templates[0]?.id ?? '')} disabled={Boolean(busy)}>
            {busy === 'create' ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            {busy === 'create' ? 'Building plan…' : 'Create first plan'}
          </button>
        </div>
      )}

      {!loading && current && (
        <article className={`st-current pl-current ${current.status}`}>
          <div className="st-current-main">
            <div className="st-current-top">
              <StatusPill status={current.status} version={current.version} />
              <span className="st-current-updated">Updated {relativeTime(current.updated_at)}</span>
            </div>
            <h3>{current.title}</h3>
            <p className="st-current-meta">
              {[current.diet_type, `${current.duration_days} days`, current.strategy_name].filter(Boolean).join(' · ')}
            </p>
            <div className="st-current-facts">
              <span><strong>{current.meals}</strong> dishes</span>
              <span><strong>{current.calories.toLocaleString()}</strong> kcal/day</span>
              <span><strong>{current.target_calories ? current.target_calories.toLocaleString() : '—'}</strong> kcal target</span>
              <span><strong>{current.days_with_meals}/7</strong> days</span>
              <span><strong>{current.readiness}%</strong> ready</span>
            </div>
            <div className="st-current-dates">
              <CalendarClock size={14} />
              {current.published_at ? `Published ${formatShortDate(current.published_at)}` : `Started ${formatShortDate(current.created_at)}`}
            </div>
          </div>
          <div className="st-current-actions">
            <button type="button" className="primary-button" onClick={() => onOpenPlan(current.id)}>
              {current.status === 'draft' ? 'Continue plan' : 'Open plan'} <ArrowRight size={15} />
            </button>
            <a className="secondary-button" href={planPdfUrl(clientId, current.id, { download: true })}>
              <Download size={15} /> PDF
            </a>
            {current.status === 'published' && (
              <button type="button" className="secondary-button" onClick={() => void revise(current.id)} disabled={Boolean(busy)}>
                {busy === current.id ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                Create revision
              </button>
            )}
            {current.status === 'draft' && (
              <button type="button" className="st-delete-draft" onClick={() => void remove(current.id)} disabled={Boolean(busy)} aria-label="Delete this draft">
                <Trash2 size={15} /> Delete draft
              </button>
            )}
          </div>
        </article>
      )}

      {!loading && rest.length > 0 && (
        <div className="st-history-table-wrap">
          <div className="st-history-table-head">
            <span>Earlier plans</span>
            <span>Version</span>
            <span>Status</span>
            <span>Updated</span>
            <span aria-hidden="true" />
          </div>
          <ul className="st-history-list">
            {rest.map((item) => (
              <li key={item.id}>
                <button type="button" className="st-history-row" onClick={() => onOpenPlan(item.id)}>
                  <span className="st-history-name">
                    <strong>{item.title}</strong>
                    <small>{[item.diet_type, `${item.meals} dishes`].filter(Boolean).join(' · ')} · Created {formatShortDate(item.created_at)}</small>
                  </span>
                  <span className="st-history-version">{item.status === 'draft' ? 'Draft' : `v${item.version}`}</span>
                  <span><StatusPill status={item.status} /></span>
                  <span className="st-history-updated">{relativeTime(item.updated_at)}</span>
                  <span className="st-history-open"><ArrowRight size={15} /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="pl-history-foot">
          <p className="st-history-foot">
            <CheckCircle2 size={14} /> Published plans are locked and versioned. A revision starts a new draft and keeps the approved PDF intact.
          </p>
          <div className="pl-history-quick">
            <button type="button" className="secondary-button compact" onClick={() => current && void duplicate(current.id)} disabled={!current || Boolean(busy)}>
              <FileText size={14} /> Duplicate current plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
