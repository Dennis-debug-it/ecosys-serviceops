import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} title={title} description={description} onClose={onCancel}>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="button-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={tone === 'danger' ? 'button-primary bg-rose-500 text-white' : 'button-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
