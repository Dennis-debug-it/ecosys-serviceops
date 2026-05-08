'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal animate-in"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="card-header">
          <div>
            <div className="card-title">{title}</div>
            <p className="modal-description">{description}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            X
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
