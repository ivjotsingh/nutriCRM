import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2
} from 'lucide-react'
import { ApiError, createRevision, createStrategy, deleteStrategy, listStrategies } from './api'
import type { StrategySummary } from './types'
import { StatusPill } from './StrategyUI'
import { formatShortDate, relativeTime } from './utils'
import './strategy.css'

export default function StrategyHistory({
  clientId,
  clientName,
  onOpenStrategy
}: {
  clientId: string
  clientName: string
  onOpenStrategy: (strategyId: string) => void
}) {
  const [strategies, setStrategies] = useState<StrategySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all')

  function load() {
    setLoading(true)
    listStrategies(clientId)
      .then((result) => {
        setStrategies(result.strategies)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load strategies'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [clientId])

  async function create() {
    setBusy('create')
    setError('')
    try {
      const detail = await createStrategy(clientId)
      onOpenStrategy(detail.strategy.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create a strategy')
    } finally {
      setBusy('')
    }
  }

  async function removeDraft(strategyId: string) {
    if (!window.confirm('Delete this draft? The published strategy and its history are not affected.')) return
    setBusy(strategyId)
    setError('')
    try {
      await deleteStrategy(clientId, strategyId)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete this draft')
    } finally {
      setBusy('')
    }
  }

  async function revise(strategyId: string) {
    setBusy(strategyId)
    setError('')
    try {
      const detail = await createRevision(clientId, strategyId)
      onOpenStrategy(detail.strategy.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create a revision')
    } finally {
      setBusy('')
    }
  }

  const visible = strategies.filter((item) => filter === 'all' || item.status === filter)
  const current = visible[0]
  const rest = visible.filter((item) => item.id !== current?.id)

  return (
    <div className="st-history">
      <div className="st-history-bar">
        <div>
          <span className="st-eyebrow"><Target size={13} /> Planning</span>
          <h3>Strategy history</h3>
          <p>Every version of {clientName.split(' ')[0]}&rsquo;s plan, from draft to published. Clinical context is pulled from the record.</p>
        </div>
        <div className="st-history-actions">
          <label className="st-filter">
            <span className="st-visually-hidden">Filter strategies</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All strategies</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button type="button" className="primary-button" onClick={() => void create()} disabled={Boolean(busy)}>
            {busy === 'create' ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            {busy === 'create' ? 'Building draft…' : 'New strategy'}
          </button>
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
        <div className="st-history-skeleton" aria-busy="true" aria-label="Loading strategies">
          <span className="cf-skeleton sk-line" style={{ width: 180 }} />
          <span className="cf-skeleton sk-block" />
          <span className="cf-skeleton sk-line" style={{ width: 260 }} />
        </div>
      )}

      {!loading && strategies.length === 0 && (
        <div className="st-history-empty">
          <span className="st-empty-mark" aria-hidden="true"><Sparkles size={24} /></span>
          <h3>Build the plan from the record, not from scratch.</h3>
          <p>
            NutriAliment prefills goals, conditions, blood markers, body composition, medications, and diet guardrails.
            You set the targets and sign off the week.
          </p>
          <ul>
            <li><CheckCircle2 size={15} /> Clinical context and deranged labs pulled automatically</li>
            <li><CheckCircle2 size={15} /> Thumb-rule, BMR, and RDA energy with 7-day macro math</li>
            <li><CheckCircle2 size={15} /> Medication interactions and food guardrails surfaced before publish</li>
          </ul>
          <button type="button" className="primary-button" onClick={() => void create()} disabled={Boolean(busy)}>
            {busy === 'create' ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            {busy === 'create' ? 'Building draft…' : 'Create first strategy'}
          </button>
        </div>
      )}

      {!loading && strategies.length > 0 && visible.length === 0 && (
        <div className="st-history-empty compact">
          <h3>No {filter} strategies</h3>
          <p>Change the filter or start a new strategy.</p>
          <button type="button" className="secondary-button" onClick={() => setFilter('all')}>Show all strategies</button>
        </div>
      )}

      {!loading && current && (
        <article className={`st-current ${current.status}`}>
          <div className="st-current-main">
            <div className="st-current-top">
              <StatusPill status={current.status} version={current.version} />
              <span className="st-current-updated">Updated {relativeTime(current.updated_at)}</span>
            </div>
            <h3>{current.name}</h3>
            <p className="st-current-meta">
              {[current.diet_type, current.major_goal, current.patient_type].filter(Boolean).join(' · ')}
            </p>
            <div className="st-current-facts">
              <span><strong>{current.calories ? current.calories.toLocaleString() : '—'}</strong> kcal</span>
              <span><strong>{current.protein || '—'}</strong> g/kg protein</span>
              <span><strong>{current.days_complete}/7</strong> days</span>
              <span><strong>{current.readiness}%</strong> ready</span>
            </div>
            <div className="st-current-dates">
              <CalendarClock size={14} />
              {current.published_at ? `Published ${formatShortDate(current.published_at)}` : `Started ${formatShortDate(current.created_at)}`}
            </div>
          </div>
          <div className="st-current-actions">
            <button type="button" className="primary-button" onClick={() => onOpenStrategy(current.id)}>
              {current.status === 'draft' ? 'Continue draft' : 'Open strategy'} <ArrowRight size={15} />
            </button>
            {current.status === 'published' && (
              <button type="button" className="secondary-button" onClick={() => void revise(current.id)} disabled={Boolean(busy)}>
                {busy === current.id ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                Create revision
              </button>
            )}
            {current.status === 'draft' && (
              <button
                type="button"
                className="st-delete-draft"
                onClick={() => void removeDraft(current.id)}
                disabled={Boolean(busy)}
                aria-label="Delete this draft"
              >
                <Trash2 size={15} /> Delete draft
              </button>
            )}
          </div>
        </article>
      )}

      {!loading && rest.length > 0 && (
        <div className="st-history-table-wrap">
          <div className="st-history-table-head">
            <span>Earlier strategies</span>
            <span>Version</span>
            <span>Status</span>
            <span>Updated</span>
            <span aria-hidden="true" />
          </div>
          <ul className="st-history-list">
            {rest.map((item) => (
              <li key={item.id}>
                <button type="button" className="st-history-row" onClick={() => onOpenStrategy(item.id)}>
                  <span className="st-history-name">
                    <strong>{item.name}</strong>
                    <small>{[item.diet_type, item.major_goal].filter(Boolean).join(' · ')} · Created {formatShortDate(item.created_at)}</small>
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

      {!loading && strategies.length > 0 && (
        <p className="st-history-foot">
          <CheckCircle2 size={14} /> Published strategies are immutable. A revision creates a new draft and preserves the signed version.
        </p>
      )}
    </div>
  )
}
