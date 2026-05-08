'use client'

import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Modal } from '@/saas/components/ui/Modal'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'

export function AppShell({ children }: { children: ReactNode }) {
  const modalState = useServiceOpsStore((state) => state.modalState)
  const closeModal = useServiceOpsStore((state) => state.closeModal)
  const createWorkOrder = useServiceOpsStore((state) => state.createWorkOrder)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar />
        <main className="content">{children}</main>
      </div>
      <Modal
        open={modalState.type === 'newWorkOrder'}
        title={modalState.type === 'newWorkOrder' ? modalState.title : ''}
        description={modalState.type === 'newWorkOrder' ? modalState.description : ''}
        onClose={closeModal}
      >
        <QuickCreateForm
          onCancel={closeModal}
          onCreate={(payload) => {
            createWorkOrder(payload)
            closeModal()
          }}
        />
      </Modal>
    </div>
  )
}

function QuickCreateForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (payload: {
    title: string
    client: string
    site: string
    asset: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    technicianName: string
    technicianInitials: string
  }) => void
}) {
  let title = ''
  let client = 'Acme HQ'
  let site = 'Westlands Campus'
  let asset = 'Chiller-03'
  let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'High'
  let technicianName = 'Control Desk'
  let technicianInitials = 'CD'

  return (
    <form
      className="modal-form"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        onCreate({
          title: String(formData.get('title') || title),
          client: String(formData.get('client') || client),
          site: String(formData.get('site') || site),
          asset: String(formData.get('asset') || asset),
          priority: String(formData.get('priority') || priority) as 'Critical' | 'High' | 'Medium' | 'Low',
          technicianName: String(formData.get('technicianName') || technicianName),
          technicianInitials: String(formData.get('technicianInitials') || technicianInitials),
        })
      }}
    >
      <div className="form-grid">
        <label>
          <span>Issue Title</span>
          <input name="title" className="field-input" defaultValue={title} placeholder="Enter a concise issue summary" />
        </label>
        <label>
          <span>Client</span>
          <input name="client" className="field-input" defaultValue={client} />
        </label>
        <label>
          <span>Site</span>
          <input name="site" className="field-input" defaultValue={site} />
        </label>
        <label>
          <span>Asset</span>
          <input name="asset" className="field-input" defaultValue={asset} />
        </label>
        <label>
          <span>Priority</span>
          <select name="priority" className="field-input" defaultValue={priority}>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
        <label>
          <span>Assigned Owner</span>
          <input name="technicianName" className="field-input" defaultValue={technicianName} />
        </label>
      </div>
      <input type="hidden" name="technicianInitials" value={technicianInitials} />
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Create Work Order
        </button>
      </div>
    </form>
  )
}
