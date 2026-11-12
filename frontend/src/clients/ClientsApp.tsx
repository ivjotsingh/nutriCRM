import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Plus, Search, Users, X } from 'lucide-react'
import { createClient, listClients } from './api'
import type { ClientRecord } from './types'
import ClientProfile from './ClientProfile'
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return clients
    return clients.filter((client) =>
      [client.name, client.phone, client.email, client.city].some((value) => value.toLowerCase().includes(needle))
    )
  }, [clients, query])

  return (
    <main className="clients-page">
      <section className="clients-hero">
        <div>
          <div className="eyebrow"><Users size={16} /> Client records</div>
          <h1>Clients</h1>
          <p>Every field is optional — add a client with a name, a phone number, or nothing at all.</p>
        </div>
        <button className="primary-button" onClick={() => setShowNew(true)}>
          <Plus size={18} /> Add client
        </button>
      </section>

      <section className="clients-panel">
        <div className="clients-toolbar">
          <label className="clients-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, phone, email, or city"
              aria-label="Search clients"
            />
          </label>
          <span className="clients-count">{filtered.length} of {clients.length}</span>
        </div>

        {error && <p className="clients-error">{error}</p>}
        {loading && <p className="clients-empty">Loading clients…</p>}
        {!loading && clients.length === 0 && (
          <div className="clients-empty-state">
            <Users size={30} />
            <h2>No clients yet</h2>
            <p>Add the first client to start a record.</p>
            <button className="primary-button" onClick={() => setShowNew(true)}><Plus size={17} /> Add client</button>
          </div>
        )}
        {!loading && clients.length > 0 && filtered.length === 0 && (
          <p className="clients-empty">No clients match “{query.trim()}”.</p>
        )}

        {filtered.length > 0 && (
          <div className="clients-list">
            {filtered.map((client) => (
              <button key={client.id} className="client-row" onClick={() => onOpen(client.id)}>
                <span className="client-avatar">{initials(client.name)}</span>
                <span className="client-row-main">
                  <strong>{client.name.trim() || 'Unnamed client'}</strong>
                  <small>{[client.city, client.phone, client.email].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="client-row-meta">
                  <small>Updated {new Date(client.updated_at).toLocaleDateString()}</small>
                  <ArrowRight size={17} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            onOpen(id)
            load()
          }}
        />
      )}
    </main>
  )
}

function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const bundle = await createClient({ name: name.trim(), phone: phone.trim(), email: email.trim(), city: city.trim(), consent })
      onCreated(bundle.client.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cf-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="cf-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title">
        <div className="cf-modal-head">
          <div>
            <span className="eyebrow">New record</span>
            <h2 id="new-client-title">Add client</h2>
          </div>
          <button className="cf-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="cf-stack">
          <label className="cf-field">
            <span>Full name <span className="cf-optional">Optional</span></span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Aarti Mehta" autoFocus />
          </label>
          <div className="cf-two">
            <label className="cf-field">
              <span>Primary phone <span className="cf-optional">Optional</span></span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
            </label>
            <label className="cf-field">
              <span>City <span className="cf-optional">Optional</span></span>
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Mumbai" />
            </label>
          </div>
          <label className="cf-field">
            <span>Email <span className="cf-optional">Optional</span></span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" inputMode="email" />
          </label>
          <label className="cf-check">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I have consent to store this client’s information and contact them. <span className="cf-optional">Optional</span></span>
          </label>
          {error && <p className="clients-error">{error}</p>}
          <div className="cf-modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
