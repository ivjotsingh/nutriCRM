import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Copy,
  Droplet,
  FileText,
  HeartPulse,
  History,
  Info,
  Layers,
  Loader2,
  Plus,
  Printer,
  Save,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
  Utensils,
  UtensilsCrossed,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { addClientOption, createClientTab, getClient, getHeadToeHistory, updateClient } from './api'
import { classifyBloodPressure } from './bloodPressure'
import type { ClientBundle, ClientRecord, ColumnDef, CustomTabField, FieldDef, HeadToeSnapshot, TabDef } from './types'
import StrategyHistory from '../strategy/StrategyHistory'
import PlanHistory from '../plans/PlanHistory'
import { Modal, ModalClose, Toast, formatDate, formatDateTime, programStatus, relativeDate } from './ui'

type TabData = Record<string, unknown>
type ClientFieldId = 'name' | 'phone' | 'email' | 'city' | 'consent' | 'start_date' | 'end_date'
const CLIENT_FIELD_IDS: ClientFieldId[] = ['name', 'phone', 'email', 'city', 'consent', 'start_date', 'end_date']

const TAB_ICONS: Record<string, LucideIcon> = {
  user: UserRound,
  activity: Activity,
  heart: HeartPulse,
  utensils: Utensils,
  clock: Clock3,
  file: FileText,
  clipboard: ClipboardList,
  droplet: Droplet,
  layers: Layers,
  target: Target
}

export default function ClientProfile({
  clientId,
  initialTab = 'basic',
  onBack,
  onOpenStrategy,
  onOpenPlan
}: {
  clientId: string
  initialTab?: string
  onBack: () => void
  onOpenStrategy: (strategyId: string) => void
  onOpenPlan: (planId: string) => void
}) {
  const [bundle, setBundle] = useState<ClientBundle | null>(null)
  const [client, setClient] = useState<ClientRecord | null>(null)
  const [data, setData] = useState<Record<string, TabData>>({})
  const [activeTabId, setActiveTabId] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [error, setError] = useState('')
  const [showTabModal, setShowTabModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HeadToeSnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const panelRef = useRef<HTMLElement | null>(null)
  const headerSaveRef = useRef<HTMLButtonElement | null>(null)
  const [headerSaveVisible, setHeaderSaveVisible] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // Switching records must never carry a tab, edit buffer, or dirty flag across.
    setBundle(null)
    setClient(null)
    setData({})
    setActiveTabId(initialTab)
    setDirty(false)
    setSavedAt('')
    setError('')
    setToast('')
    setActionError('')
    setShowHistory(false)
    setShowTabModal(false)
    getClient(clientId)
      .then((next) => {
        if (cancelled) return
        setBundle(next)
        setClient(next.client)
        setData(next.data ?? {})
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load client')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, initialTab])

  useEffect(() => {
    if (loading) return
    const node = headerSaveRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderSaveVisible(entry.isIntersecting),
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading])

  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const activeTab = bundle?.tabs.find((tab) => tab.id === activeTabId) ?? bundle?.tabs[0]
  const activeIndex = bundle && activeTab ? bundle.tabs.findIndex((tab) => tab.id === activeTab.id) : 0

  function tabData(tabId: string): TabData {
    return data[tabId] ?? {}
  }

  function updateField(fieldId: string, value: unknown) {
    if (!activeTab) return
    if (activeTab.id === 'basic' && CLIENT_FIELD_IDS.includes(fieldId as ClientFieldId) && client) {
      setClient({ ...client, [fieldId]: value })
    } else {
      setData((current) => ({
        ...current,
        [activeTab.id]: {
          ...(current[activeTab.id] ?? {}),
          [fieldId]: value
        }
      }))
    }
    setDirty(true)
    setSavedAt('')
    setError('')
    setToast('')
  }

  async function addOption(category: string, value: string) {
    if (!client) return
    const result = await addClientOption(client.id, category, value)
    setBundle((current) => current ? {
      ...current,
      options: { ...current.options, [category]: result.options }
    } : current)
  }

  async function loadHistory(): Promise<HeadToeSnapshot[]> {
    if (!client) return []
    setHistoryLoading(true)
    setActionError('')
    try {
      const result = await getHeadToeHistory(client.id)
      setHistory(result.history)
      return result.history
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load history')
      return []
    } finally {
      setHistoryLoading(false)
    }
  }

  async function openHistory() {
    setShowHistory(true)
    await loadHistory()
  }

  async function copyFrom() {
    const snapshots = await loadHistory()
    const previous = snapshots[1]
    if (!previous) {
      setActionError('No earlier version to copy yet. Save this assessment once, make changes, then try again.')
      return
    }
    applyHeadToe(previous.data)
    setToast('Previous assessment loaded')
  }

  function applyHeadToe(next: Record<string, unknown>) {
    setData((current) => ({ ...current, headtoe: next }))
    setDirty(true)
    setSavedAt('')
    setActionError('')
    setShowHistory(false)
  }

  function discard() {
    if (!bundle) return
    setClient(bundle.client)
    setData(bundle.data ?? {})
    setDirty(false)
    setSavedAt('')
    setError('')
    setToast('Changes discarded')
  }

  async function save() {
    if (!client || !bundle) return
    if (client.start_date && client.end_date && client.end_date < client.start_date) {
      setError('End date cannot be before the start date.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const next = await updateClient(client.id, {
        name: client.name,
        phone: client.phone,
        email: client.email,
        city: client.city,
        consent: client.consent,
        start_date: client.start_date,
        end_date: client.end_date,
        data
      })
      setBundle(next)
      setClient(next.client)
      setData(next.data ?? {})
      setDirty(false)
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setToast('Client record saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this client')
    } finally {
      setSaving(false)
    }
  }

  function onTabCreated(tab: TabDef) {
    setBundle((current) => current ? { ...current, tabs: [...current.tabs, tab] } : current)
    setActiveTabId(tab.id)
    setShowTabModal(false)
    setToast('Custom tab created')
  }

  function selectTab(nextId: string) {
    if (!bundle || nextId === activeTabId) return
    setActiveTabId(nextId)
    if (window.scrollY > 120) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!bundle) return
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    if (tabs.length === 0) return
    event.preventDefault()
    const current = tabs.findIndex((tab) => tab.dataset.tabId === activeTabId)
    let next = current
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    const target = tabs[next]
    target.focus()
    if (target.dataset.tabId) selectTab(target.dataset.tabId)
  }

  function goBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    onBack()
  }

  if (loading) {
    return (
      <main className="client-profile-page" aria-busy="true" aria-label="Loading client record">
        <div className="profile-skeleton">
          <div className="cf-skeleton sk-back" />
          <div className="profile-skeleton-head">
            <span className="cf-skeleton sk-avatar large" />
            <div className="profile-skeleton-copy">
              <span className="cf-skeleton sk-line" style={{ width: 140 }} />
              <span className="cf-skeleton sk-line tall" style={{ width: 260 }} />
              <span className="cf-skeleton sk-line" style={{ width: 320 }} />
            </div>
          </div>
          <div className="cf-skeleton sk-tabs" />
          <div className="cf-card">
            <span className="cf-skeleton sk-line" style={{ width: 180 }} />
            <div className="sk-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => <span className="cf-skeleton sk-input" key={index} />)}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!bundle || !client) {
    return (
      <main className="clients-page">
        <button className="cf-back" onClick={goBack}><ArrowLeft size={17} /> All clients</button>
        <div className="clients-empty-state">
          <span className="clients-empty-icon"><AlertCircle size={26} /></span>
          <h2>Client not found</h2>
          <p>{error || 'This record may have been removed.'}</p>
          <button className="secondary-button" onClick={onBack}>Back to clients</button>
        </div>
      </main>
    )
  }

  const program = programStatus(client.start_date, client.end_date)

  const statusText = saving
    ? 'Saving…'
    : dirty
      ? 'Unsaved changes'
      : savedAt
        ? `Saved at ${savedAt}`
        : 'All changes saved'

  return (
    <main className="client-profile-page">
      <div className="profile-topbar">
        <div className="profile-topbar-left">
          <button className="cf-back" onClick={goBack}><ArrowLeft size={16} /> All clients</button>
          <span className={dirty ? 'save-state dirty' : 'save-state'} role="status" aria-live="polite">
            {saving
              ? <Loader2 size={14} className="spin" aria-hidden="true" />
              : dirty
                ? <span className="cf-status-dot dirty" aria-hidden="true" />
                : <Check size={14} aria-hidden="true" />}
            {statusText}
          </span>
        </div>
        <div className="profile-actions">
          <button type="button" className="secondary-button" onClick={() => selectTab('strategy')}>
            <Target size={16} /> Strategy
          </button>
          <button type="button" className="secondary-button" onClick={() => selectTab('plans')}>
            <UtensilsCrossed size={16} /> Diet plan
          </button>
          <button className="secondary-button" onClick={() => setShowTabModal(true)}>
            <Plus size={16} /> Add tab
          </button>
          <button ref={headerSaveRef} className="primary-button" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            <span className="save-button-label">{saving ? 'Saving…' : 'Save changes'}</span>
          </button>
        </div>
      </div>

      <header className="profile-header">
        <div className="profile-identity">
          <span className="client-avatar xl" aria-hidden="true">{initials(client.name)}</span>
          <div className="profile-copy">
            <span className="profile-kicker">Client record · Added {formatDate(client.created_at)}</span>
            <h1>{client.name.trim() || 'Unnamed client'}</h1>
            <p className="profile-contact">
              {[client.city, client.phone, client.email].filter(Boolean).join(' · ') || 'No contact details yet'}
            </p>
            {(client.start_date || client.end_date) && (
              <p className="profile-program">
                Program · {formatDate(client.start_date)} – {formatDate(client.end_date)}
              </p>
            )}
          </div>
        </div>
        <div className="profile-meta">
          <div className="profile-badges">
            <span className={client.consent ? 'cf-badge consent' : 'cf-badge warn'}>
              {client.consent ? 'Consent on file' : 'Consent not recorded'}
            </span>
            {program && <span className={`cf-badge ${program.tone}`} title={program.detail}>{program.label}</span>}
          </div>
          <span className="profile-updated">Updated {relativeDate(client.updated_at)}</span>
        </div>
      </header>

      {error && (
        <div className="cf-alert" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" className="cf-icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button>
        </div>
      )}

      <div className="client-tabs-wrap">
        <nav className="client-tabs" role="tablist" aria-label="Client record sections" onKeyDown={onTabKeyDown}>
          {bundle.tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.icon ?? '']
            const selected = tab.id === activeTab?.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                data-tab-id={tab.id}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={selected ? 'client-tab active' : 'client-tab'}
                onClick={() => selectTab(tab.id)}
              >
                {Icon && <Icon size={15} aria-hidden="true" />}
                <span>{tab.label}</span>
                {tab.custom && <span className="cf-custom-badge">Custom</span>}
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab && (
        <section
          ref={panelRef}
          className="cf-card"
          id={`panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={-1}
        >
          <div className="cf-card-head">
            <div>
              <span className="cf-card-kicker">Section {activeIndex + 1} of {bundle.tabs.length}</span>
              <div className="cf-card-title">
                {activeTab.custom && <Layers size={18} aria-hidden="true" />}
                <h2>{activeTab.label}</h2>
              </div>
              {activeTab.description && <p>{activeTab.description}</p>}
            </div>
            {activeTab.id === 'strategy' ? (
              <span className="cf-optional-note"><ShieldCheck size={14} aria-hidden="true" /> Versioned &amp; signed</span>
            ) : activeTab.id === 'plans' ? (
              <span className="cf-optional-note"><FileText size={14} aria-hidden="true" /> Prints the client PDF</span>
            ) : (
              <span className="cf-optional-note"><Info size={14} aria-hidden="true" /> All fields optional</span>
            )}
          </div>

          {activeTab.id === 'headtoe' && (
            <div className="cf-headtoe-toolbar">
              <p>
                <strong>Instruction</strong> Mark <b>Yes</b> only when there is a concern. Add unlisted findings with
                <b> Add new</b>; leave anything unknown blank. This screening is not a diagnosis.
              </p>
              <div className="cf-headtoe-actions">
                <button type="button" className="secondary-button" onClick={() => void copyFrom()} disabled={historyLoading}>
                  <Copy size={15} /> Copy previous
                </button>
                <button type="button" className="secondary-button" onClick={() => void openHistory()}>
                  <History size={15} /> History
                </button>
                <button type="button" className="secondary-button" onClick={() => window.print()}>
                  <Printer size={15} /> Print / PDF
                </button>
              </div>
              {actionError && (
                <div className="cf-alert" role="alert">
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                  <button type="button" className="cf-icon-button" onClick={() => setActionError('')} aria-label="Dismiss message"><X size={15} /></button>
                </div>
              )}
            </div>
          )}

          {activeTab.id === 'strategy' ? (
            <StrategyHistory
              clientId={client.id}
              clientName={client.name}
              onOpenStrategy={onOpenStrategy}
            />
          ) : activeTab.id === 'plans' ? (
            <PlanHistory
              clientId={client.id}
              clientName={client.name}
              onOpenPlan={onOpenPlan}
            />
          ) : (
            <TabForm
              tab={activeTab}
              values={tabData(activeTab.id)}
              client={client}
              options={bundle.options}
              onChange={updateField}
              onAddOption={addOption}
            />
          )}
        </section>
      )}

      {dirty && !headerSaveVisible && (
        <div className="cf-savebar" role="region" aria-label="Unsaved changes">
          {error && <p className="cf-savebar-error" role="alert">{error}</p>}
          <div className="cf-savebar-main">
            <div className="cf-savebar-copy">
              <span className="cf-status-dot dirty" aria-hidden="true" />
              <div>
                <strong>Unsaved changes</strong>
                <small>Your edits aren’t stored yet.</small>
              </div>
            </div>
            <div className="cf-savebar-actions">
              <button type="button" className="secondary-button" onClick={discard} disabled={saving}>Discard</button>
              <button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddTabModal
        open={showTabModal}
        clientId={client.id}
        onClose={() => setShowTabModal(false)}
        onCreated={onTabCreated}
      />
      <HeadToeHistoryModal
        open={showHistory}
        snapshots={history}
        loading={historyLoading}
        onClose={() => setShowHistory(false)}
        onUse={applyHeadToe}
      />
      <Toast message={toast} onDone={() => setToast('')} />
    </main>
  )
}

function TabForm({
  tab,
  values,
  client,
  options,
  onChange,
  onAddOption
}: {
  tab: TabDef
  values: TabData
  client: ClientRecord
  options: Record<string, string[]>
  onChange: (fieldId: string, value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  function valueFor(fieldId: string): unknown {
    if (tab.id === 'basic' && CLIENT_FIELD_IDS.includes(fieldId as ClientFieldId)) {
      return client[fieldId as ClientFieldId]
    }
    return values[fieldId]
  }

  if (tab.id === 'headtoe') {
    return (
      <HeadToeForm
        tab={tab}
        values={values}
        options={options}
        onChange={onChange}
        onAddOption={onAddOption}
      />
    )
  }

  const derived = tab.id === 'bca' ? deriveBcaValues(values) : {}

  const grid = (
    <div className="cf-grid">
      {tab.fields.map((field) => {
        if (field.type === 'section') {
          return (
            <div className="cf-section" key={field.id}>
              <h3>{field.label}</h3>
              {field.help && <p>{field.help}</p>}
            </div>
          )
        }
        if (field.type === 'repeatable') {
          return (
            <div className="cf-span-3" key={field.id}>
              <RepeatableField
                tabId={tab.id}
                field={field}
                value={values[field.id]}
                options={options}
                onChange={(next) => onChange(field.id, next)}
                onAddOption={onAddOption}
              />
            </div>
          )
        }
        return (
          <FieldShell key={field.id} field={field}>
            <FieldControl
              field={field}
              value={derived[field.id] ?? valueFor(field.id)}
              category={`${tab.id}.${field.id}`}
              options={mergeOptions(field.options, options[`${tab.id}.${field.id}`])}
              onChange={(next) => onChange(field.id, next)}
              onAddOption={onAddOption}
            />
          </FieldShell>
        )
      })}
    </div>
  )

  if (tab.id === 'blood') {
    return (
      <div className="cf-stack">
        <BloodSummary values={values} />
        {grid}
      </div>
    )
  }

  return grid
}

function BloodSummary({ values }: { values: TabData }) {
  const rows = Array.isArray(values.parameters) ? (values.parameters as Record<string, unknown>[]) : []
  const flagged = rows.filter((row) => ['Low', 'High', 'Critical'].includes(String(row.flag ?? '')))
  return (
    <div className={flagged.length ? 'blood-summary has-flags' : 'blood-summary'}>
      <div className="blood-summary-head">
        <div>
          <span className="blood-summary-kicker">Deranged parameters</span>
          {rows.length === 0 ? (
            <p className="blood-summary-count">No parameters added yet.</p>
          ) : (
            <p className="blood-summary-count">
              <strong>{flagged.length}</strong> of {rows.length} parameter{rows.length === 1 ? '' : 's'} flagged
            </p>
          )}
        </div>
        <span className={flagged.length ? 'cf-badge inactive' : 'cf-badge consent'}>
          {flagged.length ? 'Needs review' : rows.length ? 'No flags' : 'No data yet'}
        </span>
      </div>
      {flagged.length > 0 ? (
        <ul className="blood-deranged-list">
          {flagged.map((row, index) => (
            <li className="blood-deranged-item" key={`${String(row.test_name ?? 'row')}-${index}`}>
              <strong>{String(row.test_name || 'Untitled parameter')}</strong>
              <span>{[row.value, row.unit].filter(Boolean).join(' ') || 'No value'}</span>
              <em className="blood-flag">{String(row.flag)}</em>
            </li>
          ))}
        </ul>
      ) : (
        <p className="blood-summary-empty">
          {rows.length ? 'No parameter is flagged Low, High, or Critical.' : 'Add parameters below. Flagged values will appear here.'}
        </p>
      )}
    </div>
  )
}

function HeadToeForm({
  tab,
  values,
  options,
  onChange,
  onAddOption
}: {
  tab: TabDef
  values: TabData
  options: Record<string, string[]>
  onChange: (fieldId: string, value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  const groups: Array<{ section: FieldDef; fields: FieldDef[] }> = []
  for (const item of tab.fields) {
    if (item.type === 'section') {
      groups.push({ section: item, fields: [] })
    } else if (groups.length) {
      groups[groups.length - 1].fields.push(item)
    }
  }
  const [intro, ...systems] = groups
  const [confirmClear, setConfirmClear] = useState(false)
  const confirmTimer = useRef<number | null>(null)

  const totals = systems.reduce((acc, group) => {
    const gate = group.fields.find((field) => field.id.endsWith('_gate'))
    const value = gate ? String(values[gate.id] ?? '') : ''
    if (value === 'Yes') acc.flagged += 1
    else if (value === 'No') acc.clear += 1
    else acc.unassessed += 1
    return acc
  }, { flagged: 0, clear: 0, unassessed: 0 })
  const assessed = totals.flagged + totals.clear
  const progress = systems.length ? Math.round((assessed / systems.length) * 100) : 0

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
  }, [])

  function markAllNo() {
    systems.forEach((group) => {
      const gate = group.fields.find((field) => field.id.endsWith('_gate'))
      if (gate) onChange(gate.id, 'No')
    })
    setConfirmClear(false)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
  }

  function onMarkAll() {
    if (!confirmClear) {
      setConfirmClear(true)
      confirmTimer.current = window.setTimeout(() => setConfirmClear(false), 4000)
      return
    }
    markAllNo()
  }

  return (
    <div className="cf-stack">
      <div className="htt-overview">
        <div className="htt-stats">
          <div className={totals.flagged ? 'htt-stat flagged' : 'htt-stat'}>
            <strong>{totals.flagged}</strong>
            <span>Flagged</span>
          </div>
          <div className="htt-stat">
            <strong>{totals.clear}</strong>
            <span>No concerns</span>
          </div>
          <div className="htt-stat">
            <strong>{totals.unassessed}</strong>
            <span>Unassessed</span>
          </div>
        </div>
        <div className="htt-progress">
          <div className="htt-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>{assessed} of {systems.length} systems assessed</small>
        </div>
      </div>

      {intro && (
        <div className="cf-grid">
          {intro.fields.map((item) => (
            <FieldShell key={item.id} field={item}>
              <FieldControl
                field={item}
                value={values[item.id]}
                category={`${tab.id}.${item.id}`}
                options={mergeOptions(item.options, options[`${tab.id}.${item.id}`])}
                onChange={(next) => onChange(item.id, next)}
                onAddOption={onAddOption}
              />
            </FieldShell>
          ))}
        </div>
      )}

      <div className="htt-systems-head">
        <div>
          <h3>Body systems</h3>
          <p>Expand a system to add findings. Unknown items can stay blank.</p>
        </div>
        <button
          type="button"
          className={confirmClear ? 'secondary-button cf-confirm' : 'secondary-button'}
          onClick={onMarkAll}
        >
          {confirmClear ? 'Confirm: mark all clear' : 'Mark all clear'}
        </button>
      </div>

      <div className="cf-systems">
        {systems.map((group) => (
          <SystemCard
            key={group.section.id}
            tabId={tab.id}
            section={group.section}
            fields={group.fields}
            values={values}
            options={options}
            onChange={onChange}
            onAddOption={onAddOption}
          />
        ))}
      </div>
    </div>
  )
}

function SystemCard({
  tabId,
  section,
  fields,
  values,
  options,
  onChange,
  onAddOption
}: {
  tabId: string
  section: FieldDef
  fields: FieldDef[]
  values: TabData
  options: Record<string, string[]>
  onChange: (fieldId: string, value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  const gate = fields.find((field) => field.id.endsWith('_gate'))
  const dataFields = fields.filter((field) => field !== gate)
  const gateValue = gate ? String(values[gate.id] ?? '') : ''
  const [open, setOpen] = useState(false)
  const previousGate = useRef(gateValue)
  const bodyId = `${section.id}-body`
  const toggleId = `${section.id}-toggle`

  const findingsField = gate ? dataFields.find((field) => field.id.endsWith('_findings')) : undefined
  const findings = findingsField && Array.isArray(values[findingsField.id]) ? (values[findingsField.id] as unknown[]) : []

  useEffect(() => {
    if (previousGate.current === gateValue) return
    if (gateValue === 'No') setOpen(false)
    if (gateValue === 'Yes') setOpen(true)
    previousGate.current = gateValue
  }, [gateValue])

  function setGate(next: string) {
    if (!gate) return
    onChange(gate.id, next)
    setOpen(next === 'Yes')
  }

  const systemName = section.label.replace(/^Head-to-Toe\s*/i, '')
  const summary = gateValue === 'Yes'
    ? findings.length
      ? `${findings.length} finding${findings.length === 1 ? '' : 's'}`
      : 'Findings to add'
    : gateValue === 'No'
      ? 'No concerns'
      : 'Not assessed'

  const ordered = [...dataFields].sort((a, b) => rankFinding(a) - rankFinding(b))

  return (
    <div className={['cf-system', gateValue === 'Yes' ? 'active' : '', open ? 'open' : ''].join(' ').trim()}>
      <div className="cf-system-head">
        <button
          type="button"
          className="cf-system-toggle"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={bodyId}
          id={toggleId}
        >
          <ChevronDown size={16} className={open ? 'cf-chevron open' : 'cf-chevron'} aria-hidden="true" />
          <span className="cf-system-name">{section.label}</span>
          <span className={gateValue === 'Yes' ? 'cf-system-summary flagged' : 'cf-system-summary'}>{summary}</span>
        </button>
        {gate && (
          <div className="cf-gate" role="group" aria-label={`Concerns in ${systemName}`}>
            <button
              type="button"
              className={gateValue === 'No' ? 'cf-gate-option active no' : 'cf-gate-option'}
              aria-pressed={gateValue === 'No'}
              onClick={() => setGate('No')}
            >
              No
            </button>
            <button
              type="button"
              className={gateValue === 'Yes' ? 'cf-gate-option active yes' : 'cf-gate-option'}
              aria-pressed={gateValue === 'Yes'}
              onClick={() => setGate('Yes')}
            >
              Yes
            </button>
          </div>
        )}
      </div>
      <div className="cf-system-body" id={bodyId} role="region" aria-labelledby={toggleId}>
        {gateValue === 'Yes' ? (
          <div className="cf-grid">
            {ordered.map((field) => (
              <FieldShell key={field.id} field={field}>
                <FieldControl
                  field={field}
                  value={values[field.id]}
                  category={`${tabId}.${field.id}`}
                  options={mergeOptions(field.options, options[`${tabId}.${field.id}`])}
                  onChange={(next) => onChange(field.id, next)}
                  onAddOption={onAddOption}
                />
              </FieldShell>
            ))}
          </div>
        ) : gateValue === 'No' ? (
          <p className="cf-system-hint">Marked as no concerns. Choose Yes to add findings.</p>
        ) : (
          <p className="cf-system-hint">Choose Yes in the header to add findings.</p>
        )}
      </div>
    </div>
  )
}

function isDerangedRow(row: Record<string, unknown>): boolean {
  return ['Low', 'High', 'Critical'].includes(String(row.flag ?? ''))
}

function rankFinding(field: FieldDef): number {
  if (field.id.endsWith('_findings')) return 0
  if (field.id.endsWith('_other')) return 1
  if (field.id.endsWith('_notes')) return 3
  return 2
}

function FieldShell({ field, children }: { field: FieldDef; children: ReactNode }) {
  const span = field.span === 3 ? 'cf-span-3' : field.span === 2 ? 'cf-span-2' : ''
  if (field.type === 'checkbox') {
    return <div className={`cf-field cf-check-field ${span}`.trim()}>{children}</div>
  }
  const label = (
    <span className="cf-label">
      {field.label}
      {field.required && <em className="cf-required" aria-hidden="true">*</em>}
      {field.read_only && <span className="cf-auto-badge" aria-hidden="true">Auto</span>}
    </span>
  )
  if (field.type === 'select' || field.type === 'multiselect') {
    // A button-based combobox is not a labelable control, so avoid wrapping it in <label>.
    return (
      <div className={`cf-field ${span}`.trim()}>
        {label}
        {children}
        {field.help && <small className="cf-help">{field.help}</small>}
      </div>
    )
  }
  return (
    <label className={`cf-field ${span}`.trim()}>
      {label}
      {children}
      {field.help && <small className="cf-help">{field.help}</small>}
    </label>
  )
}

function FieldControl({
  field,
  value,
  options,
  category,
  onChange,
  onAddOption
}: {
  field: FieldDef
  value: unknown
  options: string[]
  category: string
  onChange: (value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  if (field.type === 'checkbox') {
    return (
      <label className="cf-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>
          <strong>{field.label}</strong>
          {field.help && <small>{field.help}</small>}
        </span>
      </label>
    )
  }
  if (field.read_only) {
    return (
      <input
        type="text"
        className="cf-auto-input"
        value={String(value ?? '')}
        placeholder={field.placeholder || '—'}
        readOnly
        aria-readonly="true"
        tabIndex={-1}
      />
    )
  }
  if (field.type === 'select' || field.type === 'multiselect') {
    return (
      <ChoiceField
        label={field.label}
        value={value}
        options={options}
        multi={field.type === 'multiselect'}
        category={category}
        placeholder={field.placeholder || (field.type === 'multiselect' ? 'Select one or more' : 'Select an option')}
        onChange={onChange}
        onAddOption={onAddOption}
      />
    )
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={3}
      />
    )
  }
  const input = (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
    />
  )
  if (field.id === 'blood_pressure') {
    return (
      <span className="cf-bp-field">
        {input}
        <BloodPressureHint value={value} />
      </span>
    )
  }
  return input
}

function BloodPressureHint({ value }: { value: unknown }) {
  const result = classifyBloodPressure(value)
  if (result.status === 'empty') return null
  if (result.status === 'invalid') {
    return (
      <span className="cf-bp-readout invalid" role="status">
        <Info size={13} aria-hidden="true" />
        <span>{result.message}</span>
      </span>
    )
  }

  const reading = result.reading
  const measured = `${reading.systolic}/${reading.diastolic ?? '—'} mmHg`
  return (
    <span className={`cf-bp-readout ${reading.tone}`} role="status" aria-live="polite">
      <span className="cf-bp-badge">{reading.category}</span>
      <span className="cf-bp-measure">{measured}</span>
      <span className="cf-bp-reference">{reading.reference} · {reading.source}</span>
      <span className="cf-bp-guidance">{reading.guidance}</span>
    </span>
  )
}

function RepeatableField({
  tabId,
  field,
  value,
  options,
  onChange,
  onAddOption
}: {
  tabId: string
  field: FieldDef
  value: unknown
  options: Record<string, string[]>
  onChange: (value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
  const columns = field.columns ?? []

  function updateCell(rowIndex: number, columnId: string, cellValue: unknown) {
    const next = rows.map((row, index) => index === rowIndex ? { ...row, [columnId]: cellValue } : row)
    onChange(next)
  }

  function addRow() {
    onChange([...rows, {}])
  }

  function removeRow(rowIndex: number) {
    onChange(rows.filter((_, index) => index !== rowIndex))
  }

  return (
    <div className="cf-repeatable">
      <div className="cf-repeat-head">
        <div>
          <h3>{field.label} {rows.length > 0 && <span className="cf-count">{rows.length}</span>}</h3>
          {field.help && <p>{field.help}</p>}
        </div>
        <button type="button" className="secondary-button cf-add-row" onClick={addRow}>
          <Plus size={15} /> {field.add_label || 'Add row'}
        </button>
      </div>
      <p className="cf-table-hint">Scroll sideways to see all columns.</p>
      <div
        className="cf-table-wrap"
        role="region"
        aria-label={`${field.label} table`}
        tabIndex={0}
      >
        <table className="cf-table">
          <caption className="cf-visually-hidden">{field.label}</caption>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.id} style={{ minWidth: column.width ?? 150 }}>{column.label}</th>)}
              <th className="cf-action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="cf-table-empty">
                  <span>No rows yet.</span>
                  <button type="button" className="cf-link-button" onClick={addRow}>
                    <Plus size={14} /> Add the first row
                  </button>
                </td>
              </tr>
            )}
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={isDerangedRow(row) ? 'cf-row-flagged' : undefined}>
                {columns.map((column) => (
                  <td key={column.id}>
                    <CellControl
                      column={column}
                      value={row[column.id]}
                      category={`${tabId}.${field.id}.${column.id}`}
                      options={mergeOptions(column.options, options[`${tabId}.${field.id}.${column.id}`])}
                      onChange={(next) => updateCell(rowIndex, column.id, next)}
                      onAddOption={onAddOption}
                    />
                  </td>
                ))}
                <td className="cf-action-col">
                  <button
                    type="button"
                    className="cf-icon-button danger"
                    onClick={() => removeRow(rowIndex)}
                    aria-label={`Delete ${field.label} row ${rowIndex + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CellControl({
  column,
  value,
  options,
  category,
  onChange,
  onAddOption
}: {
  column: ColumnDef
  value: unknown
  options: string[]
  category: string
  onChange: (value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  if (column.type === 'combo') {
    return (
      <ComboField
        label={column.label}
        value={value}
        options={options}
        category={category}
        placeholder={column.placeholder || 'Type to search or add new'}
        onChange={onChange}
        onAddOption={onAddOption}
      />
    )
  }
  if (column.type === 'select') {
    return (
      <ChoiceField
        label={column.label}
        value={value}
        options={options}
        category={category}
        placeholder={column.placeholder || 'Select'}
        compact
        onChange={onChange}
        onAddOption={onAddOption}
      />
    )
  }
  if (column.type === 'textarea') {
    return <textarea value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={column.placeholder} rows={2} aria-label={column.label} />
  }
  return (
    <input
      type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : column.type === 'time' ? 'time' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder={column.placeholder}
      aria-label={column.label}
    />
  )
}

function useFloatingPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
  minWidth = 300
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    let frame = 0

    function place() {
      frame = 0
      const node = anchorRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const margin = 10
      const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - margin * 2)
      const spaceBelow = window.innerHeight - rect.bottom - margin
      const spaceAbove = rect.top - margin
      const below = spaceBelow >= 240 || spaceBelow >= spaceAbove
      const maxHeight = Math.max(80, Math.min(380, below ? spaceBelow : spaceAbove))
      const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin))
      setStyle({
        position: 'fixed',
        left,
        width,
        maxHeight,
        top: below ? rect.bottom + 6 : 'auto',
        bottom: below ? 'auto' : window.innerHeight - rect.top + 6,
        visibility: 'visible'
      })
    }

    function schedule() {
      if (frame) return
      frame = window.requestAnimationFrame(place)
    }

    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [open, anchorRef, panelRef, minWidth])

  return style
}

function ChoiceField({
  label,
  value,
  options,
  multi = false,
  compact = false,
  category,
  placeholder,
  onChange,
  onAddOption
}: {
  label: string
  value: unknown
  options: string[]
  multi?: boolean
  compact?: boolean
  category: string
  placeholder: string
  onChange: (value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const panelStyle = useFloatingPanel(open, rootRef, popoverRef, 320)
  const selected = multi
    ? (Array.isArray(value) ? value.map(String) : [])
    : value ? [String(value)] : []

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const filtered = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))
  const trimmed = query.trim()
  const canAdd = Boolean(trimmed) && !options.some((option) => option.toLowerCase() === trimmed.toLowerCase())

  function choose(option: string) {
    if (multi) {
      const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]
      onChange(next)
    } else {
      onChange(option)
      setOpen(false)
      setQuery('')
    }
  }

  async function add() {
    if (!canAdd || adding) return
    setAdding(true)
    setAddError('')
    try {
      await onAddOption(category, trimmed)
      if (multi) {
        onChange([...selected, trimmed])
      } else {
        onChange(trimmed)
        setOpen(false)
      }
      setQuery('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to add option')
    } finally {
      setAdding(false)
    }
  }

  const visibleChips = multi && !compact ? selected.slice(0, 2) : []
  const hiddenCount = selected.length - visibleChips.length

  return (
    <div className={`cf-choice ${compact ? 'compact' : ''}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={selected.length ? 'cf-choice-button has-value' : 'cf-choice-button'}
        onClick={() => { setOpen((current) => !current); setQuery('') }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={selected.length ? `${label}: ${selected.join(', ')}` : label}
      >
        <span className="cf-choice-value">
          {selected.length === 0 && <span className="cf-choice-placeholder">{placeholder}</span>}
          {visibleChips.length > 0 && (
            <>
              {visibleChips.map((item) => <span className="cf-chip" key={item}>{item}</span>)}
              {hiddenCount > 0 && <span className="cf-chip more">+{hiddenCount}</span>}
            </>
          )}
          {multi && compact && selected.length > 0 && <span className="cf-choice-plain">{selected.join(', ')}</span>}
          {!multi && selected.length > 0 && <span className="cf-choice-plain">{selected[0]}</span>}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="cf-popover" ref={popoverRef} style={panelStyle}>
          <input
            className="cf-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or add new…"
            autoFocus
            aria-label={`Search ${label} options`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter') {
                if (canAdd) {
                  event.preventDefault()
                  void add()
                } else if (filtered.length === 1) {
                  event.preventDefault()
                  choose(filtered[0])
                }
              }
            }}
          />
          <div className="cf-option-list" role="listbox" aria-multiselectable={multi || undefined} aria-label={label}>
            {filtered.length === 0 && !canAdd && <p className="cf-option-empty">No options yet.</p>}
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected.includes(option)}
                className={selected.includes(option) ? 'cf-option selected' : 'cf-option'}
                onClick={() => choose(option)}
              >
                <span>{option}</span>
                {selected.includes(option) && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {canAdd && (
            <button type="button" className="cf-add-option" onClick={() => void add()} disabled={adding}>
              <Plus size={14} /> {adding ? 'Adding…' : `Add “${trimmed}”`}
            </button>
          )}
          {addError && <p className="cf-add-error" role="alert">{addError}</p>}
          {multi && selected.length > 0 && (
            <button type="button" className="cf-clear-options" onClick={() => onChange([])}>Clear selection</button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function ComboField({
  label,
  value,
  options,
  category,
  placeholder,
  onChange,
  onAddOption
}: {
  label: string
  value: unknown
  options: string[]
  category: string
  placeholder: string
  onChange: (value: unknown) => void
  onAddOption: (category: string, value: string) => Promise<void>
}) {
  const text = String(value ?? '')
  const [draft, setDraft] = useState(text)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const persistedRef = useRef<Set<string>>(new Set())
  const listId = useId()
  const panelStyle = useFloatingPanel(open, rootRef, popoverRef, 300)
  const search = query.trim()
  const trimmed = draft.trim()
  const filtered = options.filter((option) => option.toLowerCase().includes(search.toLowerCase()))
  const exact = options.find((option) => option.toLowerCase() === search.toLowerCase())
  const canAdd = Boolean(search) && !exact

  useEffect(() => {
    if (!open) setDraft(text)
  }, [open, text])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onFocusIn(event: FocusEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  async function persistOption(next: string) {
    const clean = next.trim()
    if (!clean) return
    const key = clean.toLowerCase()
    if (options.some((option) => option.toLowerCase() === key) || persistedRef.current.has(key) || adding) return
    persistedRef.current.add(key)
    setAdding(true)
    setError('')
    try {
      await onAddOption(category, clean)
    } catch {
      persistedRef.current.delete(key)
      setError('New value could not be saved to the shared list. The typed value is still kept in this record.')
    } finally {
      setAdding(false)
    }
  }

  function choose(option: string) {
    onChange(option)
    setDraft(option)
    setOpen(false)
    setQuery('')
    setError('')
  }

  function commitDraft() {
    const match = options.find((option) => option.toLowerCase() === trimmed.toLowerCase())
    if (match) {
      if (match !== text) onChange(match)
    } else if (trimmed) {
      onChange(trimmed)
      void persistOption(trimmed)
    } else if (text) {
      onChange('')
    }
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="cf-combo">
      <div className="cf-combo-control" ref={rootRef}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setQuery(event.target.value)
            setOpen(true)
            setError('')
          }}
          onFocus={() => {
            setDraft(text)
            setQuery('')
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(text)
              setQuery('')
              setOpen(false)
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              if (filtered.length === 1) choose(filtered[0])
              else if (exact) choose(exact)
              else commitDraft()
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-label={label}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          className="cf-combo-toggle"
          tabIndex={-1}
          aria-label={open ? `Hide ${label} options` : `Show ${label} options`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false)
              inputRef.current?.blur()
              return
            }
            setDraft(text)
            setQuery('')
            setOpen(true)
            inputRef.current?.focus()
          }}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="cf-combo-error" role="alert">{error}</p>}
      {open && createPortal(
        <div className="cf-popover" ref={popoverRef} style={panelStyle}>
          <div className="cf-option-list" id={`${listId}-list`} role="listbox" aria-label={label}>
            {filtered.length === 0 && !canAdd && <p className="cf-option-empty">No matching options.</p>}
            {filtered.map((option) => {
              const selected = option.toLowerCase() === draft.trim().toLowerCase()
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'cf-option selected' : 'cf-option'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span>{option}</span>
                  {selected && <Check size={14} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          {canAdd && (
            <button
              type="button"
              className="cf-add-option"
              disabled={adding}
              onMouseDown={(event) => event.preventDefault()}
              onClick={commitDraft}
            >
              <Plus size={14} /> {adding ? 'Saving…' : `Add “${trimmed}”`}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function HeadToeHistoryModal({
  open,
  snapshots,
  loading,
  onClose,
  onUse
}: {
  open: boolean
  snapshots: HeadToeSnapshot[]
  loading: boolean
  onClose: () => void
  onUse: (data: Record<string, unknown>) => void
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="headtoe-history-title">
      <div className="cf-modal-head">
        <div>
          <span className="eyebrow">Saved versions</span>
          <h2 id="headtoe-history-title">Head-to-Toe history</h2>
          <p className="cf-modal-lede">Restore an earlier assessment to review or continue it.</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      {loading && <p className="clients-empty">Loading history…</p>}
      {!loading && snapshots.length === 0 && (
        <div className="clients-empty-state compact">
          <span className="clients-empty-icon"><History size={24} /></span>
          <h2>No saved versions yet</h2>
          <p>Save this assessment once to create the first version.</p>
        </div>
      )}
      {!loading && snapshots.length > 0 && (
        <div className="cf-history-list">
          {snapshots.map((snapshot, index) => {
            const filled = Object.values(snapshot.data).filter((item) => item !== '' && item != null && !(Array.isArray(item) && item.length === 0)).length
            return (
              <div className="cf-history-row" key={snapshot.id}>
                <span className={index === 0 ? 'cf-history-dot current' : 'cf-history-dot'} aria-hidden="true" />
                <div className="cf-history-copy">
                  <strong>
                    {index === 0 ? 'Current saved version' : formatDateTime(snapshot.created_at)}
                    {index === 0 && <span className="cf-badge consent">Current</span>}
                  </strong>
                  <small>{filled} filled values · {relativeDate(snapshot.created_at)}</small>
                </div>
                <button type="button" className="secondary-button" onClick={() => onUse(snapshot.data)}>
                  {index === 0 ? 'Use this version' : 'Restore'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function AddTabModal({
  open,
  clientId,
  onClose,
  onCreated
}: {
  open: boolean
  clientId: string
  onClose: () => void
  onCreated: (tab: TabDef) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<Array<{ label: string; type: string; options: string }>>([
    { label: '', type: 'text', options: '' }
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setLabel('')
      setDescription('')
      setFields([{ label: '', type: 'text', options: '' }])
      setSaving(false)
      setError('')
    }
  }, [open])

  function updateField(index: number, patch: Partial<{ label: string; type: string; options: string }>) {
    setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!label.trim()) { setError('Tab name is required.'); return }
    if (fields.some((field) => !field.label.trim())) { setError('Every field needs a label.'); return }
    setSaving(true)
    setError('')
    try {
      const payload: CustomTabField[] = fields.map((field) => ({
        label: field.label.trim(),
        type: field.type as CustomTabField['type'],
        options: field.options.split(',').map((option) => option.trim()).filter(Boolean),
        span: 1
      }))
      const result = await createClientTab(clientId, { label: label.trim(), description: description.trim(), fields: payload })
      onCreated(result.tab)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create tab')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="add-tab-title" className="wide">
      <div className="cf-modal-head">
        <div>
          <span className="eyebrow">Custom section</span>
          <h2 id="add-tab-title">Add a tab</h2>
          <p className="cf-modal-lede">Create a section for anything this record doesn’t already cover.</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <form onSubmit={submit} className="cf-stack">
        <div className="cf-two">
          <label className="cf-field">
            <span className="cf-label">Tab name <em className="cf-required" aria-hidden="true">*</em></span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Supplement trial"
              data-autofocus
            />
          </label>
          <label className="cf-field">
            <span className="cf-label">Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this tab tracks" />
          </label>
        </div>

        <div className="cf-builder">
          <div className="cf-builder-head">
            <span>Fields <span className="cf-count">{fields.length}</span></span>
            <button
              type="button"
              className="secondary-button cf-add-field"
              onClick={() => setFields((current) => [...current, { label: '', type: 'text', options: '' }])}
            >
              <Plus size={15} /> Add field
            </button>
          </div>
          {fields.map((field, index) => (
            <div className="cf-builder-row" key={index}>
              <span className="cf-builder-index" aria-hidden="true">{index + 1}</span>
              <input
                value={field.label}
                onChange={(event) => updateField(index, { label: event.target.value })}
                placeholder={`Field ${index + 1} label`}
                aria-label={`Field ${index + 1} label`}
              />
              <select
                value={field.type}
                onChange={(event) => updateField(index, { type: event.target.value })}
                aria-label={`Field ${index + 1} type`}
              >
                <option value="text">Text box</option>
                <option value="textarea">Textarea</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
                <option value="select">Dropdown</option>
                <option value="multiselect">Multi-select</option>
                <option value="checkbox">Checkbox</option>
              </select>
              {(field.type === 'select' || field.type === 'multiselect') && (
                <input
                  value={field.options}
                  onChange={(event) => updateField(index, { options: event.target.value })}
                  placeholder="Options, comma separated"
                  aria-label={`Field ${index + 1} options`}
                />
              )}
              <button
                type="button"
                className="cf-icon-button danger"
                onClick={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))}
                aria-label={`Remove field ${index + 1}`}
                disabled={fields.length === 1}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {error && <div className="cf-alert" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
        <div className="cf-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            {saving ? 'Creating…' : 'Create tab'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function deriveBcaValues(values: TabData): Record<string, string> {
  const derived: Record<string, string> = {}
  const heightCm = numericValue(values.height_cm) || (numericValue(values.height_ft) * 30.48 + numericValue(values.height_in) * 2.54)
  const weightKg = numericValue(values.weight_kg) || numericValue(values.weight_lbs) * 0.45359237
  if (heightCm > 0 && weightKg > 0) {
    derived.bmi = (weightKg / ((heightCm / 100) ** 2)).toFixed(2)
  }
  const waistCm = numericValue(values.waist_cm) || numericValue(values.waist_in) * 2.54
  const hipCm = numericValue(values.hip_cm) || numericValue(values.hip_in) * 2.54
  if (waistCm > 0 && hipCm > 0) {
    derived.waist_hip_ratio = (waistCm / hipCm).toFixed(2)
  }
  return derived
}

function numericValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function mergeOptions(base: string[] | undefined, custom: string[] | undefined): string[] {
  const merged: string[] = []
  for (const value of [...(base ?? []), ...(custom ?? [])]) {
    if (!merged.some((item) => item.toLowerCase() === value.toLowerCase())) merged.push(value)
  }
  return merged
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'N'
}
