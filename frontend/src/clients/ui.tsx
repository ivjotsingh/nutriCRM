import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, X } from 'lucide-react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  labelledBy,
  className = '',
  children
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  className?: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const node = dialogRef.current

    function focusables(): HTMLElement[] {
      if (!node) return []
      return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null)
    }

    const frame = requestAnimationFrame(() => {
      // Never steal focus from a field the user (or a quick autofill) already reached.
      if (node && document.activeElement instanceof Node && node.contains(document.activeElement)) return
      const target = node?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node
      target?.focus()
    })

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !node?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="cf-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`cf-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="cf-icon-button" onClick={onClose} aria-label="Close dialog">
      <X size={18} />
    </button>
  )
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => doneRef.current(), 3200)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="cf-toast" role="status">
      <CheckCircle2 size={17} />
      <span>{message}</span>
      <button type="button" className="cf-toast-close" onClick={onDone} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  )
}

export function relativeDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export type ProgramStatus = {
  label: 'Active' | 'Inactive' | 'Upcoming'
  tone: 'active' | 'inactive' | 'upcoming'
  detail: string
}

function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function programStatus(start?: string | null, end?: string | null): ProgramStatus | null {
  const from = (start ?? '').trim()
  const to = (end ?? '').trim()
  if (!from && !to) return null
  const today = localToday()
  if (to && to < today) {
    return { label: 'Inactive', tone: 'inactive', detail: `Ended ${formatDate(to)}` }
  }
  if (from && from > today) {
    return { label: 'Upcoming', tone: 'upcoming', detail: `Starts ${formatDate(from)}` }
  }
  if (to) return { label: 'Active', tone: 'active', detail: `Until ${formatDate(to)}` }
  return { label: 'Active', tone: 'active', detail: `Since ${formatDate(from)}` }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
