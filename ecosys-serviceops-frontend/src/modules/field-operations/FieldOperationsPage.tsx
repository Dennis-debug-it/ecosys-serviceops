import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTenantData } from '../../app/useTenant'
import { Badge } from '../../components/ui/Badge'
import { Drawer } from '../../components/ui/Drawer'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/ToastProvider'
import { technicianService } from '../../services/technicianService'
import { TECHNICIAN_AVAILABILITY, TECHNICIAN_STATUSES } from '../../utils/constants'
import { technicianTone } from '../../utils/format'

export function FieldOperationsPage() {
  const { tenantId, data } = useTenantData()
  const { pushToast } = useToast()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    branchId: '',
    groupId: '',
    skills: 'Generators, UPS',
    availability: 'Available',
    status: 'Online',
    phone: '',
  })

  if (!data) {
    return <EmptyState title="No technicians" description="Tenant data is unavailable." actionLabel="Refresh" />
  }

  const technicians = technicianService.list(tenantId)

  const openEditor = (technicianId?: string) => {
    const technician = technicianId ? data.technicians.find((item) => item.id === technicianId) : undefined
    setEditingId(technician?.id ?? null)
    setForm({
      fullName: technician?.fullName ?? '',
      branchId: technician?.branchId ?? data.branches[0]?.id ?? '',
      groupId: technician?.groupId ?? data.settings.technicianGroups[0]?.id ?? '',
      skills: technician?.skills.join(', ') ?? '',
      availability: technician?.availability ?? 'Available',
      status: technician?.status ?? 'Online',
      phone: technician?.phone ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const payload = {
      fullName: form.fullName,
      branchId: form.branchId,
      groupId: form.groupId,
      skills: form.skills.split(',').map((item) => item.trim()).filter(Boolean),
      availability: form.availability as (typeof TECHNICIAN_AVAILABILITY)[number],
      status: form.status as (typeof TECHNICIAN_STATUSES)[number],
      phone: form.phone,
    }
    if (editingId) {
      technicianService.update(tenantId, editingId, payload)
      pushToast({ title: 'Technician updated', description: 'Field operations register updated.', tone: 'success' })
    } else {
      technicianService.add(tenantId, payload)
      pushToast({ title: 'Technician added', description: 'Technician is now available for assignment.', tone: 'success' })
    }
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Field Operations"
        title="Technicians"
        description="Manage technician groups, skills, availability, and workload from live work order assignment data."
        actions={
          <button type="button" className="button-primary" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            Add Technician
          </button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {technicians.map((technician) => (
          <article key={technician.id} className="surface-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-app">{technician.fullName}</p>
                <p className="mt-1 text-sm text-muted">{data.branches.find((branch) => branch.id === technician.branchId)?.name} • {data.settings.technicianGroups.find((group) => group.id === technician.groupId)?.name}</p>
              </div>
              <Badge tone={technicianTone(technician.status)}>{technician.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Availability" value={technician.availability} />
              <Info label="Active Jobs" value={String(technician.activeWorkOrderIds.length)} />
              <Info label="Phone" value={technician.phone} />
              <Info label="Skills" value={technician.skills.join(', ')} />
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="button-secondary" onClick={() => openEditor(technician.id)}>Edit Technician</button>
            </div>
          </article>
        ))}
      </section>

      <Drawer open={open} title={editingId ? 'Edit technician' : 'Add technician'} description="Technicians are linked to groups and branch workload." onClose={() => setOpen(false)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="field-input" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="field-input" />
          </Field>
          <Field label="Branch">
            <select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} className="field-input">
              {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </Field>
          <Field label="Group">
            <select value={form.groupId} onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))} className="field-input">
              {data.settings.technicianGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </Field>
          <Field label="Availability">
            <select value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))} className="field-input">
              {TECHNICIAN_AVAILABILITY.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="field-input">
              {TECHNICIAN_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Skills (comma separated)">
          <input value={form.skills} onChange={(event) => setForm((current) => ({ ...current, skills: event.target.value }))} className="field-input" />
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="button-primary" onClick={save}>Save Technician</button>
        </div>
      </Drawer>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-subtle rounded-2xl px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm text-app">{value}</p>
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
