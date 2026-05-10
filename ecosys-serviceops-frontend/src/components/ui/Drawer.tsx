import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { UI_RESET_EVENT, cleanupBodyInteractivity } from '../../utils/appCleanup'

export function Drawer({
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
    if (!open) {
      cleanupBodyInteractivity()
      return
    }

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handleUiReset = () => {
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(UI_RESET_EVENT, handleUiReset)
    return () => {
      cleanupBodyInteractivity()
      body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(UI_RESET_EVENT, handleUiReset)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div data-ui-overlay="true" className="fixed inset-0 z-50 flex items-center justify-end bg-overlay/90 p-0 sm:p-4" onClick={onClose}>
      <div className="glass-panel h-full max-h-screen w-full max-w-3xl overflow-hidden rounded-none sm:max-h-[94vh] sm:rounded-[24px]" onClick={(event) => event.stopPropagation()}>
        <div className="border-app flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-semibold text-app">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <button type="button" className="icon-button h-10 w-10" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-88px)] overflow-y-auto px-4 py-5 sm:max-h-[calc(94vh-88px)] sm:px-6">
          {children}
        </div>
      </div>
    </div>
  )
}
