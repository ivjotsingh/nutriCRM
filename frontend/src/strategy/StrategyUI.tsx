import { type ReactNode, useState } from 'react'
import { AlertCircle, Check, Plus, ShieldCheck, X } from 'lucide-react'
import type { ReadinessCheck, StrategyStatus } from './types'

export function StatusPill({ status, version }: { status: StrategyStatus; version?: number }) {
  const label = status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft'
  return (
    <span className={`st-status ${status}`}>
      <span className="st-status-dot" aria-hidden="true" />
      {label}
      {version && status !== 'draft' ? <em>v{version}</em> : null}
    </span>
  )
}

export function Ring({ value, size = 62, label }: { value: number; size?: number; label?: string }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference
  return (
    <span className="st-ring" style={{ width: size, height: size }} aria-label={`${label ?? 'Readiness'}: ${value}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="st-ring-track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="st-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <strong>{value}</strong>
    </span>
  )
}

export function MacroBar({
  cho,
  pro,
  fat,
  compact = false
}: {
  cho: number
  pro: number
  fat: number
  compact?: boolean
}) {
  const total = cho + pro + fat || 1
  const width = (value: number) => `${Math.max(0, (value / total) * 100)}%`
  return (
    <span className={compact ? 'st-macro-bar compact' : 'st-macro-bar'} aria-hidden="true">
      <span className="st-macro-cho" style={{ width: width(cho) }} />
      <span className="st-macro-pro" style={{ width: width(pro) }} />
      <span className="st-macro-fat" style={{ width: width(fat) }} />
    </span>
  )
}

export function TagEditor({
  label,
  values,
  options,
  onChange,
  placeholder,
  help,
  locked = false,
  tone = 'teal'
}: {
  label: string
  values: string[]
  options: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  help?: string
  locked?: boolean
  tone?: 'teal' | 'amber'
}) {
  const [draft, setDraft] = useState('')

  function add(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (values.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...values, trimmed])
    setDraft('')
  }

  function remove(value: string) {
    onChange(values.filter((item) => item !== value))
  }

  const available = options.filter((option) => !values.some((value) => value.toLowerCase() === option.toLowerCase()))

  return (
    <div className={`st-tagfield ${tone}`}>
      <div className="st-tagfield-head">
        <span className="st-label">{label}</span>
        {help && <span className="st-help">{help}</span>}
      </div>
      {values.length > 0 && (
        <div className="st-tags">
          {values.map((value) => (
            <span className="st-tag" key={value}>
              {value}
              {!locked && (
                <button type="button" onClick={() => remove(value)} aria-label={`Remove ${value}`}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!locked && (
        <form
          className="st-tag-add-form"
          onSubmit={(event) => {
            event.preventDefault()
            add(draft)
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder ?? 'Type and press Enter'}
            aria-label={`Add ${label}`}
          />
          <button type="submit" className="st-tag-add-button" disabled={!draft.trim()}>
            <Plus size={14} /> Add
          </button>
        </form>
      )}
      {!locked && available.length > 0 && (
        <div className="st-tag-suggestions">
          {available.slice(0, 8).map((option) => (
            <button type="button" key={option} className="st-suggestion" onClick={() => add(option)}>
              <Plus size={11} /> {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CheckRow({
  checked,
  onChange,
  title,
  description,
  badge,
  disabled = false
}: {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  description: string
  badge?: string
  disabled?: boolean
}) {
  return (
    <label className={checked ? 'st-checkrow checked' : 'st-checkrow'}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span className="st-checkbox" aria-hidden="true">{checked && <Check size={13} />}</span>
      <span className="st-checkrow-copy">
        <span>
          <strong>{title}</strong>
          {badge && <em className={badge === 'Required' ? 'st-mini-badge required' : 'st-mini-badge'}>{badge}</em>}
        </span>
        <small>{description}</small>
      </span>
    </label>
  )
}

export function ReadinessRow({ check, onJump }: { check: ReadinessCheck; onJump: (section: string) => void }) {
  const tone = check.status === 'pass' ? 'pass' : check.status === 'warn' ? 'warn' : 'fail'
  return (
    <div className={`st-readiness-row ${tone}`}>
      <span className="st-readiness-icon" aria-hidden="true">
        {check.status === 'pass' ? <Check size={13} /> : check.status === 'warn' ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}
      </span>
      <span className="st-readiness-copy">
        <strong>{check.label}</strong>
        <small>{check.detail}</small>
      </span>
      {check.status !== 'pass' ? (
        <button type="button" className="st-link" onClick={() => onJump(check.section)}>
          Fix
        </button>
      ) : (
        <span className="st-readiness-ok">Ready</span>
      )}
    </div>
  )
}

export function Metric({
  label,
  value,
  unit,
  tone = 'ink',
  hint
}: {
  label: string
  value: ReactNode
  unit?: string
  tone?: 'ink' | 'teal' | 'coral' | 'amber' | 'muted'
  hint?: string
}) {
  return (
    <div className={`st-metric ${tone}`}>
      <span>{label}</span>
      <strong>
        {value}
        {unit && <em>{unit}</em>}
      </strong>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  lede,
  actions
}: {
  eyebrow: string
  title: string
  lede?: string
  actions?: ReactNode
}) {
  return (
    <div className="st-section-head">
      <div>
        <span className="st-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {lede && <p>{lede}</p>}
      </div>
      {actions && <div className="st-section-actions">{actions}</div>}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="st-empty-note">{children}</p>
}
