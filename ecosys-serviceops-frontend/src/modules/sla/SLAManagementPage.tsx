import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTenantData, useWorkOrderViews } from '../../app/useTenant'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { Drawer } from '../../components/ui/Drawer'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/ToastProvider'
import { slaService } from '../../services/slaService'
import { PRIORITIES } from '../../utils/constants'
import { slaTone } from '../../utils/format'

export function SLAManagementPage() {
  const { tenantId, data } = useTenantData()
  const { pushToast } = useToast()
  const workOrders = useWorkOrderViews()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', priorityLevel: 'High', responseTimeHours: 1, resolutionTimeHours: 8, escalationPath: '', clientIds: [] as string[] })

  if (!data) {
    return <EmptyState title="No SLA rules" description="Tenant data is unavailable." actionLabel="Refresh" />
  }

  const openEditor = (ruleId?: string) => {
    const rule = ruleId ? data.slaRules.find((item) => item.id === ruleId) : undefined
    setEditingId(rule?.id ?? null)
    setForm({
      name: rule?.name ?? '',
      priorityLevel: rule?.priorityLevel ?? 'High',
      responseTimeHours: rule?.responseTimeHours ?? 1,
      resolutionTimeHours: rule?.resolutionTimeHours ?? 8,
      escalationPath: rule?.escalationPath ?? '',
      clientIds: rule?.clientIds ?? [],
    })
    setOpen(true)
  }

  const save = () => {
    const payload = {
      name: form.name,
      priorityLevel: form.priorityLevel as (typeof PRIORITIES)[number],
      responseTimeHours: Number(form.responseTimeHours),
      resolutionTimeHours: Number(form.resolutionTimeHours),
      escalationPath: form.escalationPath,
      clientIds: form.clientIds,
    }
    if (editingId) {
      slaService.update(tenantId, editingId, payload)
      pushToast({ title: 'SLA rule updated', description: 'SLA configuration saved.', tone: 'success' })
    } else {
      slaService.add(tenantId, payload)
      pushToast({ title: 'SLA rule created', description: 'New SLA rule is available for client mapping.', tone: 'success' })
    }
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="SLA"
        title="SLA Management"
        description="Manage response and resolution targets, escalation paths, client mapping, and live SLA watchlists."
        actions={
          <button type="button" className="button-primary" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            Create SLA Rule
          </button>
        }
      />

      <section className="surface-card">
        <DataTable
          rows={data.slaRules}
          rowKey={(row) => row.id}
          pageSize={6}
          columns={[
            { key: 'name', header: 'Rule', cell: (row) => <div><p className="font-semibold text-app">{row.name}</p><p className="mt-1 text-xs text-muted">{row.priorityLevel}</p></div> },
            { key: 'response', header: 'Response', cell: (row) => <p>{row.responseTimeHours}h</p> },
            { key: 'resolution', header: 'Resolution', cell: (row) => <p>{row.resolutionTimeHours}h</p> },
            { key: 'escalation', header: 'Escalation', cell: (row) => <p className="text-sm text-muted">{row.escalationPath}</p> },
            { key: 'mapping', header: 'Client Mapping', cell: (row) => <p>{row.clientIds.length} clients</p> },
            { key: 'actions', header: 'Actions', cell: (row) => <button type="button" className="button-secondary px-3 py-2" onClick={() => openEditor(row.id)}>Edit</button> },
          ]}
        />
      </section>

      <section className="surface-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">Live SLA Watchlist</p>
            <p className="text-sm text-muted">Calculated from current work order due dates.</p>
          </div>
          <Badge tone="warning">{workOrders.filter((item) => item.slaStatus !== 'On Track').length} flagged</Badge>
        </div>
        <div className="space-y-3">
          {workOrders.filter((item) => item.slaStatus !== 'On Track').slice(0, 8).map((workOrder) => (
            <div key={workOrder.id} className="panel-subtle rounded-[24px] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-app">{workOrder.workOrderNumber}</p>
                  <p className="mt-1 text-xs text-muted">{workOrder.clientName} • {workOrder.siteName}</p>
                </div>
                <Badge tone={slaTone(workOrder.slaStatus)}>{workOrder.slaStatus}</Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Drawer open={open} title={editingId ? 'Edit SLA rule' : 'Create SLA rule'} description="SLA rules are later mapped to clients and reflected on work order countdowns." onClose={() => setOpen(false)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Rule name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="field-input" /></Field>
          <Field label="Priority">
            <select value={form.priorityLevel} onChange={(event) => setForm((current) => ({ ...current, priorityLevel: event.target.value }))} className="field-input">
              {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Response time (hours)"><input type="number" min={0.5} step={0.5} value={form.responseTimeHours} onChange={(event) => setForm((current) => ({ ...current, responseTimeHours: Number(event.target.value) || 1 }))} className="field-input" /></Field>
          <Field label="Resolution time (hours)"><input type="number" min={1} value={form.resolutionTimeHours} onChange={(event) => setForm((current) => ({ ...current, resolutionTimeHours: Number(event.target.value) || 8 }))} className="field-input" /></Field>
        </div>
        <Field label="Escalation path"><textarea value={form.escalationPath} onChange={(event) => setForm((current) => ({ ...current, escalationPath: event.target.value }))} className="field-input min-h-[120px]" /></Field>
        <Field label="Client mapping">
          <div className="grid gap-3 md:grid-cols-2">
            {data.clients.map((client) => (
              <label key={client.id} className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3">
                <span className="text-sm text-app">{client.name}</span>
                <input
                  type="checkbox"
                  checked={form.clientIds.includes(client.id)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      clientIds: event.target.checked ? [...current.clientIds, client.id] : current.clientIds.filter((item) => item !== client.id),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="button-primary" onClick={save}>Save Rule</button>
        </div>
      </Drawer>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-app">{label}</span>
      {children}
    </label>
  )
}
