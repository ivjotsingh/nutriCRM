import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Layers, Plus, Save, Trash2, X } from 'lucide-react'
import { addClientOption, createClientTab, getClient, getHeadToeHistory, updateClient } from './api'
import type { ClientBundle, ClientRecord, ColumnDef, CustomTabField, FieldDef, HeadToeSnapshot, TabDef } from './types'

type TabData = Record<string, unknown>
type ClientFieldId = 'name' | 'phone' | 'email' | 'city' | 'consent'
const CLIENT_FIELD_IDS: ClientFieldId[] = ['name', 'phone', 'email', 'city', 'consent']

export default function ClientProfile({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [bundle, setBundle] = useState<ClientBundle | null>(null)
  const [client, setClient] = useState<ClientRecord | null>(null)
  const [data, setData] = useState<Record<string, TabData>>({})
  const [activeTabId, setActiveTabId] = useState('basic')
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

  useEffect(() => {
    setLoading(true)
    getClient(clientId)
      .then((next) => {
        setBundle(next)
        setClient(next.client)
        setData(next.data ?? {})
        setActiveTabId((current) => (next.tabs.some((tab) => tab.id === current) ? current : next.tabs[0]?.id ?? 'basic'))
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load client'))
      .finally(() => setLoading(false))
  }, [clientId])

  const activeTab = bundle?.tabs.find((tab) => tab.id === activeTabId) ?? bundle?.tabs[0]

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
  }

  function applyHeadToe(next: Record<string, unknown>) {
    setData((current) => ({ ...current, headtoe: next }))
    setDirty(true)
    setSavedAt('')
    setActionError('')
    setShowHistory(false)
  }

  async function save() {
    if (!client || !bundle) return
    setSaving(true)
    setError('')
    try {
      const next = await updateClient(client.id, {
        name: client.name,
        phone: client.phone,
        email: client.email,
        city: client.city,
        consent: client.consent,
        data
      })
      setBundle(next)
      setClient(next.client)
      setData(next.data ?? {})
      setDirty(false)
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
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
  }

  if (loading) {
    return <main className="clients-page"><p className="clients-empty">Loading client…</p></main>
  }

  if (!bundle || !client) {
    return (
      <main className="clients-page">
        <button className="cf-back" onClick={onBack}><ArrowLeft size={17} /> All clients</button>
        <p className="clients-error">{error || 'Client not found.'}</p>
      </main>
    )
  }

  return (
    <main className="client-profile-page">
      <div className="client-profile-head">
        <button className="cf-back" onClick={onBack}><ArrowLeft size={17} /> All clients</button>
        <div className="client-profile-title">
          <span className="client-avatar large">{initials(client.name)}</span>
          <div>
            <h1>{client.name || 'Unnamed client'}</h1>
            <p>{[client.city, client.phone, client.email].filter(Boolean).join(' · ') || 'Add contact details whenever you like'}</p>
          </div>
        </div>
        <div className="client-save">
          <button className="secondary-button" onClick={() => setShowTabModal(true)}>
            <Plus size={16} /> Add tab
          </button>
          <span className={dirty ? 'cf-dirty' : 'cf-saved'}>
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedAt ? `Saved ${savedAt}` : 'All changes saved'}
          </span>
          <button className="primary-button" onClick={save} disabled={saving || !dirty}>
            <Save size={17} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <p className="clients-error">{error}</p>}

      <nav className="client-tabs" aria-label="Client record tabs">
        {bundle.tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeTab?.id ? 'client-tab active' : 'client-tab'}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.label}
            {tab.custom && <span className="cf-custom-badge">Custom</span>}
          </button>
        ))}
      </nav>

      {activeTab && (
        <section className="cf-card">
          <div className="cf-card-head">
            <div>
              <div className="cf-card-title">
                {activeTab.custom && <Layers size={17} />}
                <h2>{activeTab.label}</h2>
              </div>
              {activeTab.description && <p>{activeTab.description}</p>}
            </div>
            <span className="cf-optional-note">All fields optional unless marked</span>
          </div>
          {activeTab.id === 'headtoe' && (
            <div className="cf-headtoe-toolbar">
              <p>
                <strong>Instructions</strong> Mark <b>Yes</b> only when there is a concern. Add unlisted findings with
                <b> Add new</b>; leave anything unknown blank. This screening is not a diagnosis.
              </p>
              <div className="cf-headtoe-actions">
                <button type="button" className="secondary-button" onClick={() => void copyFrom()} disabled={historyLoading}>
                  Copy From
                </button>
                <button type="button" className="secondary-button" onClick={() => void openHistory()}>
                  History
                </button>
                <button type="button" className="secondary-button" onClick={() => window.print()}>Print</button>
                <button type="button" className="secondary-button" onClick={() => window.print()}>PDF</button>
                <button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {actionError && <p className="clients-error">{actionError}</p>}
            </div>
          )}
          <TabForm
            tab={activeTab}
            values={tabData(activeTab.id)}
            client={client}
            options={bundle.options}
            onChange={updateField}
            onAddOption={addOption}
          />
        </section>
      )}

      {showTabModal && <AddTabModal clientId={client.id} onClose={() => setShowTabModal(false)} onCreated={onTabCreated} />}
      {showHistory && (
        <HeadToeHistoryModal
          snapshots={history}
          loading={historyLoading}
          onClose={() => setShowHistory(false)}
          onUse={applyHeadToe}
        />
      )}
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

  return (
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
              value={valueFor(field.id)}
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

  function markAllNo() {
    systems.forEach((group) => {
      const gate = group.fields.find((field) => field.id.endsWith('_gate'))
      if (gate) onChange(gate.id, 'No')
    })
  }

  return (
    <div className="cf-stack">
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
      <div className="cf-headtoe-actions">
        <button type="button" className="secondary-button" onClick={markAllNo}>Mark all as no known issues</button>
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

  useEffect(() => {
    if (previousGate.current === gateValue) return
    if (gateValue === 'No') setOpen(false)
    if (gateValue === 'Yes') setOpen(true)
    previousGate.current = gateValue
  }, [gateValue])

  function setGate(next: string) {
    if (!gate) return
    onChange(gate.id, next)
    if (next === 'Yes') setOpen(true)
  }

  const systemName = section.label.replace(/^Head-to-Toe\s*/i, '')

  return (
    <div className={[gateValue === 'Yes' ? 'cf-system active' : 'cf-system', open ? 'open' : ''].join(' ').trim()}>
      <div className="cf-system-head">
        <button type="button" className="cf-system-toggle" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          <span className="cf-system-name">{section.label}</span>
          <span className={gateValue === 'Yes' ? 'cf-status-pill yes' : gateValue === 'No' ? 'cf-status-pill no' : 'cf-status-pill'}>
            {gateValue || 'Not assessed'}
          </span>
          <ChevronDown size={16} className={open ? 'cf-chevron open' : 'cf-chevron'} />
        </button>
        {gate && (
          <label className="cf-gate">
            <span className="cf-visually-hidden">Any concerns in {systemName}?</span>
            <select value={gateValue} onChange={(event) => setGate(event.target.value)} aria-label={`Any concerns in ${systemName}?`}>
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>
        )}
      </div>
      <div className="cf-system-body">
        {gateValue === 'Yes' ? (
          <div className="cf-grid">
            {dataFields.map((field) => (
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
          <p className="cf-system-hint">Marked as no concerns. Select Yes to add findings.</p>
        ) : (
          <p className="cf-system-hint">Select Yes in the header to add findings.</p>
        )}
      </div>
    </div>
  )
}

function FieldShell({ field, children }: { field: FieldDef; children: ReactNode }) {
  const span = field.span === 3 ? 'cf-span-3' : field.span === 2 ? 'cf-span-2' : ''
  if (field.type === 'checkbox') {
    return <div className={`cf-field cf-check-field ${span}`.trim()}>{children}</div>
  }
  return (
    <label className={`cf-field ${span}`.trim()}>
      <span className="cf-label">
        {field.label}
        {field.required ? <em className="cf-required">*</em> : <span className="cf-optional">Optional</span>}
      </span>
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
        <span>{field.label}{field.required ? <em className="cf-required"> *</em> : null}</span>
      </label>
    )
  }
  if (field.type === 'select' || field.type === 'multiselect') {
    return (
      <ChoiceField
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
  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
    />
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
          <h3>{field.label}</h3>
          {field.help && <p>{field.help}</p>}
        </div>
        <button type="button" className="secondary-button cf-add-row" onClick={addRow}>
          <Plus size={15} /> {field.add_label || 'Add row'}
        </button>
      </div>
      <div className="cf-table-wrap">
        <table className="cf-table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.id} style={{ minWidth: column.width ?? 150 }}>{column.label}</th>)}
              <th className="cf-action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="cf-table-empty">No rows yet. Add one when it is useful.</td>
              </tr>
            )}
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
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
                  <button type="button" className="cf-icon-button danger" onClick={() => removeRow(rowIndex)} aria-label={`Delete ${field.label} row`}>
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
  if (column.type === 'select') {
    return (
      <ChoiceField
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
    return <textarea value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={column.placeholder} rows={2} />
  }
  return (
    <input
      type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : column.type === 'time' ? 'time' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder={column.placeholder}
    />
  )
}

function ChoiceField({
  value,
  options,
  multi = false,
  compact = false,
  category,
  placeholder,
  onChange,
  onAddOption
}: {
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
  const selected = multi
    ? (Array.isArray(value) ? value.map(String) : [])
    : value ? [String(value)] : []

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
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

  return (
    <div className={`cf-choice ${compact ? 'compact' : ''}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={selected.length ? 'cf-choice-button has-value' : 'cf-choice-button'}
        onClick={() => { setOpen((current) => !current); setQuery('') }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selected.length ? selected.join(', ') : placeholder}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="cf-popover">
          <input
            className="cf-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or add new…"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter' && canAdd) { event.preventDefault(); void add() }
            }}
          />
          <div className="cf-option-list" role="listbox">
            {filtered.length === 0 && !canAdd && <p className="cf-option-empty">No options yet.</p>}
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                className={selected.includes(option) ? 'cf-option selected' : 'cf-option'}
                onClick={() => choose(option)}
              >
                <span>{option}</span>
                {selected.includes(option) && <Check size={14} />}
              </button>
            ))}
            {canAdd && (
              <button type="button" className="cf-add-option" onClick={() => void add()} disabled={adding}>
                <Plus size={14} /> {adding ? 'Adding…' : `Add “${trimmed}”`}
              </button>
            )}
            {multi && selected.length > 0 && (
              <button type="button" className="cf-clear-options" onClick={() => onChange([])}>Clear selection</button>
            )}
          </div>
          {addError && <p className="cf-add-error">{addError}</p>}
        </div>
      )}
    </div>
  )
}

function HeadToeHistoryModal({
  snapshots,
  loading,
  onClose,
  onUse
}: {
  snapshots: HeadToeSnapshot[]
  loading: boolean
  onClose: () => void
  onUse: (data: Record<string, unknown>) => void
}) {
  return (
    <div className="cf-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="cf-modal" role="dialog" aria-modal="true" aria-labelledby="headtoe-history-title">
        <div className="cf-modal-head">
          <div>
            <span className="eyebrow">Saved versions</span>
            <h2 id="headtoe-history-title">Head-to-Toe history</h2>
          </div>
          <button className="cf-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {loading && <p className="clients-empty">Loading history…</p>}
        {!loading && snapshots.length === 0 && <p className="clients-empty">No saved versions yet. Use Save to create one.</p>}
        {!loading && snapshots.length > 0 && (
          <div className="cf-history-list">
            {snapshots.map((snapshot, index) => (
              <div className="cf-history-row" key={snapshot.id}>
                <div>
                  <strong>{index === 0 ? 'Current saved version' : new Date(snapshot.created_at).toLocaleString()}</strong>
                  <small>{Object.values(snapshot.data).filter((value) => value !== '' && value != null).length} filled values</small>
                </div>
                <button type="button" className="secondary-button" onClick={() => onUse(snapshot.data)}>
                  {index === 0 ? 'Use this version' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AddTabModal({
  clientId,
  onClose,
  onCreated
}: {
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
    <div className="cf-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="cf-modal wide" role="dialog" aria-modal="true" aria-labelledby="add-tab-title">
        <div className="cf-modal-head">
          <div>
            <span className="eyebrow">Dynamic tab</span>
            <h2 id="add-tab-title">Add a tab</h2>
          </div>
          <button className="cf-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="cf-stack">
          <div className="cf-two">
            <label className="cf-field">
              <span>Tab name <em>*</em></span>
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Supplement trial" autoFocus />
            </label>
            <label className="cf-field">
              <span>Description</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this tab tracks" />
            </label>
          </div>

          <div className="cf-builder">
            <div className="cf-builder-head">
              <span>Fields</span>
              <button type="button" className="secondary-button" onClick={() => setFields((current) => [...current, { label: '', type: 'text', options: '' }])}>
                <Plus size={15} /> Add field
              </button>
            </div>
            {fields.map((field, index) => (
              <div className="cf-builder-row" key={index}>
                <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder={`Field ${index + 1} label`} aria-label={`Field ${index + 1} label`} />
                <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value })} aria-label={`Field ${index + 1} type`}>
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
                  <input value={field.options} onChange={(event) => updateField(index, { options: event.target.value })} placeholder="Options, comma separated" aria-label={`Field ${index + 1} options`} />
                )}
                <button type="button" className="cf-icon-button danger" onClick={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))} aria-label="Remove field">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {error && <p className="clients-error">{error}</p>}
          <div className="cf-modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Creating…' : 'Create tab'}</button>
          </div>
        </form>
      </div>
    </div>
  )
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
