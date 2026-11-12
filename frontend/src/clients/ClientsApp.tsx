import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Loader2, Plus, Search, UserRound, Users, X } from 'lucide-react'
import { createClient, listClients } from './api'
import type { ClientRecord } from './types'
import ClientProfile from './ClientProfile'
import { Modal, ModalClose, programStatus, relativeDate } from './ui'
import './clients.css'

function clientIdFromHash(): string {
  const match = window.location.hash.match(/^#clients\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : ''
}

export default function ClientsApp() {
  const [clientId, setClientId] = useState(clientIdFromHash)

  useEffect(() => {
    const onHash = () => setClientId(clientIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (clientId) {
    return <ClientProfile clientId={clientId} onBack={() => { window.location.hash = 'clients' }} />
  }

  return <ClientDirectory onOpen={(id) => { window.location.hash = `clients/${id}` }} />
}

function ClientDirectory({ onOpen }: { onOpen: (id: string) => void }) {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    listClients()
      .then((result) => {
        setClients(result.clients)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load clients'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return clients
    return clients.filter((client) =>
      [client.name, client.phone, client.email, client.city].some((value) => value.toLowerCase().includes(needle))
    )
  }, [clients, query])

  const countLabel = query.trim()
    ? `${filtered.length} of ${clients.length}`
    : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`

  return (
    <main className="clients-page" id="main-content" tabIndex={-1}>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Users size={15} /> Client records</div>
          <h1>Clients</h1>
          <p className="page-lede">
            One record per person. Add what you know now — the full medical and dietary profile can be completed later.
          </p>
        </div>
        <button className="primary-button page-head-action" onClick={() => setShowNew(true)}>
          <Plus size={17} /> Add client
        </button>
      </header>

      <section className="clients-panel" aria-labelledby="client-list-title">
        <h2 className="cf-visually-hidden" id="client-list-title">Client records</h2>
        <div className="clients-toolbar">
          <label className="clients-search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setQuery('')
              }}
              placeholder="Search by name, phone, email, or city"
              aria-label="Search clients"
              aria-keyshortcuts="/"
            />
            {query ? (
              <button type="button" className="clients-search-clear" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Clear search">
                <X size={15} />
              </button>
            ) : (
              <kbd className="clients-search-hint" aria-hidden="true">/</kbd>
            )}
          </label>
          <span className="clients-count" aria-live="polite">{countLabel}</span>
        </div>

        {error && (
          <div className="cf-alert" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button type="button" className="cf-link-button" onClick={load}>Try again</button>
          </div>
        )}

        {loading && (
          <div className="clients-skeleton" aria-busy="true" aria-label="Loading clients">
            {[0, 1, 2].map((index) => (
              <div className="client-row-skeleton" key={index}>
                <span className="cf-skeleton sk-avatar" />
                <span className="client-row-skeleton-copy">
                  <span className="cf-skeleton sk-line" style={{ width: `${45 - index * 6}%` }} />
                  <span className="cf-skeleton sk-line thin" style={{ width: `${62 - index * 8}%` }} />
                </span>
                <span className="cf-skeleton sk-line" style={{ width: 90 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && clients.length === 0 && (
          <div className="clients-empty-state">
            <span className="clients-empty-icon"><UserRound size={26} /></span>
            <h2>No clients yet</h2>
            <p>Create the first record. Only a name is needed to begin.</p>
            <button className="primary-button" onClick={() => setShowNew(true)}><Plus size={17} /> Add client</button>
          </div>
        )}

        {!loading && clients.length > 0 && filtered.length === 0 && (
          <div className="clients-empty-state compact">
            <span className="clients-empty-icon"><Search size={24} /></span>
            <h2>No matches for “{query.trim()}”</h2>
            <p>Try a name, phone number, email, or city.</p>
            <button className="secondary-button" onClick={() => { setQuery(''); searchRef.current?.focus() }}>Clear search</button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <>
            <div className="clients-table-head" aria-hidden="true">
              <span>Client</span>
              <span>Contact</span>
              <span>Consent</span>
              <span className="align-right">Updated</span>
            </div>
            <ul className="clients-list">
              {filtered.map((client) => {
                const status = programStatus(client.start_date, client.end_date)
                return (
                <li key={client.id}>
                  <button className="client-row" onClick={() => onOpen(client.id)}>
                    <span className="client-avatar" aria-hidden="true">{initials(client.name)}</span>
                    <span className="client-row-main">
                      <span className="client-row-name">
                        <strong>{client.name.trim() || 'Unnamed client'}</strong>
                        {status && status.label !== 'Active' && (
                          <span className={`cf-badge ${status.tone}`} title={status.detail}>{status.label}</span>
                        )}
                      </span>
                      <small>{[client.city, client.phone].filter(Boolean).join(' · ') || 'No contact details'}</small>
                    </span>
                    <span className="client-row-contact">{client.email || '—'}</span>
                    <span className="client-row-consent">
                      {client.consent
                        ? <span className="cf-badge consent">On file</span>
                        : <span className="cf-badge">Missing</span>}
                    </span>
                    <span className="client-row-meta">
                      <small>{relativeDate(client.updated_at)}</small>
                      <span className="client-row-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <footer className="clients-foot">
        <span className="cf-status-dot" aria-hidden="true" />
        Local prototype · Records are stored on this device
      </footer>

      <NewClientModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(id) => {
          setShowNew(false)
          load()
          onOpen(id)
        }}
      />
    </main>
  )
}

function NewClientModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
      setPhone('')
      setEmail('')
      setCity('')
      setStartDate('')
      setEndDate('')
      setConsent(false)
      setSaving(false)
      setError('')
    }
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (startDate && endDate && endDate < startDate) {
      setError('End date cannot be before the start date.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const bundle = await createClient({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        consent,
        start_date: startDate,
        end_date: endDate
      })
      onCreated(bundle.client.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-client-title">
      <div className="cf-modal-head">
        <div>
          <span className="eyebrow">New record</span>
          <h2 id="new-client-title">Add client</h2>
          <p className="cf-modal-lede">Only add what you know now. The rest can be completed on the record.</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <form onSubmit={submit} className="cf-stack">
        <label className="cf-field">
          <span className="cf-label">Full name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Aarti Mehta"
            data-autofocus
            autoComplete="name"
          />
        </label>
        <div className="cf-two">
          <label className="cf-field">
            <span className="cf-label">Primary phone</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" inputMode="tel" autoComplete="tel" />
          </label>
          <label className="cf-field">
            <span className="cf-label">City</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Mumbai" autoComplete="address-level2" />
          </label>
        </div>
        <label className="cf-field">
          <span className="cf-label">Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" inputMode="email" autoComplete="email" />
        </label>
        <div className="cf-two">
          <label className="cf-field">
            <span className="cf-label">Program start date</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="cf-field">
            <span className="cf-label">Program end date</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <p className="cf-modal-hint">Program dates are optional and set whether the client shows as Active, Upcoming, or Inactive.</p>
        <label className="cf-consent-card">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>
            <strong>Consent to store and contact</strong>
            <small>Recorded consent lets you keep this client’s health details and follow up. You can change this later.</small>
          </span>
        </label>
        {error && <div className="cf-alert" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
        <div className="cf-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? <Loader2 size={17} className="spin" /> : <Plus size={17} />}
            {saving ? 'Adding…' : 'Add client'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'N'
}
