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
    <div data-ui-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-[95vw] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          <button type="button" className="icon-button h-10 w-10" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
