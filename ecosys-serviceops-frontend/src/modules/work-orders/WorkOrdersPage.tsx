import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useShellContext } from '../../components/layout/AppShell'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { InfoAlert } from '../../components/ui/InfoAlert'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/ToastProvider'
import { MetricCard, MetricGrid, PageScaffold, SearchToolbar, SectionCard, SegmentedTabs } from '../../components/ui/Workspace'
import { useAsyncData } from '../../hooks/useAsyncData'
import { assetService } from '../../services/assetService'
import { clientService } from '../../services/clientService'
import { pmTemplateService } from '../../services/pmTemplateService'
import { settingsService } from '../../services/settingsService'
import { siteService } from '../../services/siteService'
import { technicianService } from '../../services/technicianService'
import { userService } from '../../services/userService'
import { workOrderService } from '../../services/workOrderService'
import type { AssetRecord, AssignmentGroupRecord, ClientRecord, PmTemplateRecord, SiteRecord, TechnicianRecord, UserRecord, WorkOrder } from '../../types/api'
import { formatDateOnly } from '../../utils/date'
import { priorityTone, statusTone } from '../../utils/format'

type WorkOrdersPayload = {
  workOrders: WorkOrder[]
  clients: ClientRecord[]
  assets: AssetRecord[]
  technicians: TechnicianRecord[]
  users: UserRecord[]
  assignmentGroups: AssignmentGroupRecord[]
  pmTemplates: PmTemplateRecord[]
}

type WorkOrderDraft = {
  clientId: string
  siteId: string
  assetId: string
  assignmentType: 'IndividualTechnician' | 'MultipleTechnicians' | 'AssignmentGroup' | 'Unassigned'
  assignedTechnicianIds: string[]
  assignmentGroupId: string
  leadTechnicianId: string
  assignmentNotes: string
  isPreventiveMaintenance: boolean
  pmTemplateId: string
  title: string
  description: string
  priority: string
  dueDate: string
}

const emptyPayload: WorkOrdersPayload = {
  workOrders: [],
  clients: [],
  assets: [],
  technicians: [],
  users: [],
  assignmentGroups: [],
  pmTemplates: [],
}

const emptyForm = (): WorkOrderDraft => ({
  clientId: '',
  siteId: '',
  assetId: '',
  assignmentType: 'Unassigned' as const,
  assignedTechnicianIds: [] as string[],
  assignmentGroupId: '',
  leadTechnicianId: '',
  assignmentNotes: '',
  isPreventiveMaintenance: false,
  pmTemplateId: '',
  title: '',
  description: '',
  priority: 'Medium',
  dueDate: '',
})

export function WorkOrdersPage() {
  const { selectedBranchId } = useShellContext()
  const { pushToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [priority, setPriority] = useState('All')
  const [assignmentGroupFilter, setAssignmentGroupFilter] = useState('All')
  const [technicianFilter, setTechnicianFilter] = useState('All')
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)
  const [technicianQuery, setTechnicianQuery] = useState('')
  const [groupQuery, setGroupQuery] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<WorkOrderDraft>(emptyForm)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [sites, setSites] = useState<SiteRecord[]>([])

  const { data, loading, error, reload } = useAsyncData<WorkOrdersPayload>(
    async (signal) => {
      const [workOrders, clients, assets, technicians, users, assignmentGroups, pmTemplates] = await Promise.all([
        workOrderService.list(selectedBranchId, signal),
        clientService.list({ signal, status: 'active' }),
        assetService.list(selectedBranchId, signal),
        technicianService.list(selectedBranchId, signal),
        userService.list(signal),
        settingsService.listAssignmentGroups(signal),
        pmTemplateService.list(signal),
      ])

      return { workOrders, clients, assets, technicians, users, assignmentGroups, pmTemplates }
    },
    emptyPayload,
    [selectedBranchId],
  )

  useEffect(() => {
    setCurrentTime(Date.now())
  }, [data.workOrders])

  useEffect(() => {
    if (!form.clientId) {
      setSites([])
      return
    }
    let cancelled = false
    siteService.list(form.clientId, { status: 'Active' }).then((result) => {
      if (!cancelled) setSites(result)
    }).catch(() => { if (!cancelled) setSites([]) })
    return () => { cancelled = true }
  }, [form.clientId])

  const filteredRows = useMemo(() => {
    return data.workOrders
      .filter((item) => status === 'All' || item.status === status)
      .filter((item) => priority === 'All' || item.priority === priority)
      .filter((item) => assignmentGroupFilter === 'All' || item.assignmentGroupId === assignmentGroupFilter)
      .filter((item) => technicianFilter === 'All' || item.technicianAssignments?.some((assignment) => assignment.technicianId === technicianFilter))
      .filter((item) => !showUnassignedOnly || item.isUnassigned)
      .filter((item) =>
        `${item.workOrderNumber} ${item.title} ${item.clientName || ''} ${resolveAssignedGroupName(item)} ${resolveAssignedToName(item)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
  }, [assignmentGroupFilter, data.workOrders, priority, search, showUnassignedOnly, status, technicianFilter])
  const statusTabs = [
    { id: 'All', label: 'All queue', meta: data.workOrders.length },
    { id: 'Open', label: 'Open', meta: data.workOrders.filter((item) => item.status === 'Open').length },
    { id: 'In Progress', label: 'In progress', meta: data.workOrders.filter((item) => item.status === 'In Progress').length },
    { id: 'Awaiting Parts', label: 'Awaiting parts', meta: data.workOrders.filter((item) => item.status === 'Awaiting Parts').length },
    { id: 'Completed', label: 'Completed', meta: data.workOrders.filter((item) => item.status === 'Completed').length },
  ] as const
  const hasWorkOrders = data.workOrders.length > 0
  const visibleAssets = data.assets.filter((asset) => {
    if (form.clientId && asset.clientId !== form.clientId) return false
    if (form.siteId && asset.siteId !== form.siteId) return false
    return true
  })
  const activePmTemplates = data.pmTemplates.filter((template) => template.isActive)
  const availableTechnicians = data.technicians.filter((technician) => technician.isActive)
  const dispatchableUsers = data.users.filter((user): user is UserRecord & { linkedTechnicianId: string } => user.isActive && typeof user.linkedTechnicianId === 'string' && user.linkedTechnicianId.length > 0)
  const usersByTechnicianId = new Map(
    dispatchableUsers.map((user) => [user.linkedTechnicianId, user]),
  )
  const availableGroups = data.assignmentGroups.filter((group) => group.isActive)
  const selectedGroup = availableGroups.find((group) => group.id === form.assignmentGroupId)
  const groupMembers = availableTechnicians.filter((technician) => selectedGroup?.members.some((member) => member.technicianId === technician.id))
  const groupMemberUsers = selectedGroup?.members
    .map((member) => usersByTechnicianId.get(member.technicianId))
    .filter((user): user is UserRecord & { linkedTechnicianId: string } => Boolean(user?.linkedTechnicianId)) ?? []
  const visibleUsers = dispatchableUsers.filter((user) => user.fullName.toLowerCase().includes(technicianQuery.toLowerCase()))
  const visibleGroups = availableGroups.filter((group) => `${group.name} ${group.skillArea || ''}`.toLowerCase().includes(groupQuery.toLowerCase()))
  const overdueCount = data.workOrders.filter((item) => {
    if (!item.dueDate || stringEquals(item.status, 'Completed') || stringEquals(item.status, 'Closed') || stringEquals(item.status, 'Cancelled')) {
      return false
    }
    return new Date(item.dueDate).getTime() < currentTime
  }).length
  const unassignedCount = data.workOrders.filter((item) => item.isUnassigned).length
  const pmCount = data.workOrders.filter((item) => item.isPreventiveMaintenance).length

  function openCreateModal() {
    setSaveError('')
    setTechnicianQuery('')
    setGroupQuery('')
    setSites([])
    setForm(emptyForm())
    setEditorOpen(true)
  }

  const createWorkOrder = async () => {
    if (saving) return

    if (!form.clientId || !form.title.trim()) {
      setSaveError('Client and title are required before creating a work order.')
      return
    }

    if (form.assignmentType === 'IndividualTechnician' && !form.leadTechnicianId) {
      setSaveError('Select one user before creating a direct assignment.')
      return
    }

    if (form.assignmentType === 'MultipleTechnicians' && form.assignedTechnicianIds.length === 0) {
      setSaveError('Select at least one user for a multi-user assignment.')
      return
    }

    if (form.assignmentType === 'MultipleTechnicians' && form.leadTechnicianId && !form.assignedTechnicianIds.includes(form.leadTechnicianId)) {
      setSaveError('Lead technician must be one of the selected technicians.')
      return
    }

    if (form.assignmentType === 'AssignmentGroup' && !form.assignmentGroupId) {
      setSaveError('Select an assignment group before creating the work order.')
      return
    }

    if (form.assignmentType === 'AssignmentGroup' && form.leadTechnicianId && !groupMembers.some((technician) => technician.id === form.leadTechnicianId)) {
      setSaveError('Lead technician override must belong to the selected group.')
      return
    }

    if (form.isPreventiveMaintenance && !form.pmTemplateId) {
      setSaveError('Select a PM template before creating a preventive maintenance work order.')
      return
    }

    setSaving(true)
    setSaveError('')

    try {
      await workOrderService.create({
        clientId: form.clientId,
        branchId: selectedBranchId === 'all' ? null : selectedBranchId,
        siteId: form.siteId || null,
        assetId: form.assetId || null,
        assignmentType: form.assignmentType,
        assignmentGroupId: form.assignmentType === 'AssignmentGroup' ? form.assignmentGroupId || null : null,
        assignedTechnicianId: form.assignmentType === 'Unassigned' ? null : form.leadTechnicianId || form.assignedTechnicianIds[0] || null,
        assignedTechnicianIds: form.assignmentType === 'MultipleTechnicians' ? form.assignedTechnicianIds : [],
        leadTechnicianId: form.leadTechnicianId || null,
        assignmentNotes: form.assignmentNotes.trim() || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        isPreventiveMaintenance: form.isPreventiveMaintenance,
        pmTemplateId: form.isPreventiveMaintenance ? form.pmTemplateId || null : null,
      })
      pushToast({
        title: 'Work order created',
        description: form.assignmentType === 'Unassigned' ? 'The work order was saved as unassigned.' : 'The new work order has been created successfully.',
        tone: 'success',
      })
      setForm(emptyForm())
      setEditorOpen(false)
      await reload()
    } catch (nextError) {
      setSaveError(nextError instanceof Error ? nextError.message : 'Unable to create work order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageScaffold
      eyebrow="Operations"
      title="Work orders"
      description="Track dispatch, live field progress, due dates, and unassigned backlog from one operational queue."
      actions={
        <button type="button" className="button-primary w-full sm:w-auto" onClick={() => openCreateModal()}>
          <Plus className="h-4 w-4" />
          New work order
        </button>
      }
    >
      <MetricGrid>
        <MetricCard label="Total queue" value={data.workOrders.length} meta={`${filteredRows.length} in current view`} emphasis="accent" />
        <MetricCard label="In progress" value={data.workOrders.filter((item) => item.status === 'In Progress').length} meta="Active field jobs" />
        <MetricCard label="Overdue" value={overdueCount} meta="Past due and still open" emphasis={overdueCount > 0 ? 'danger' : 'default'} />
        <MetricCard label="Unassigned / PM" value={`${unassignedCount} / ${pmCount}`} meta="Dispatch backlog and preventive work" emphasis={unassignedCount > 0 ? 'warning' : 'default'} />
      </MetricGrid>

      <SectionCard
        title="Dispatch queue"
        description="Use the same operational queue to triage reactive jobs, PM visits, and unassigned requests."
        action={<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{formatDateOnly(new Date().toISOString())}</div>}
      >
        <div className="space-y-4">
          <SegmentedTabs tabs={statusTabs.map((tab) => ({ ...tab, meta: String(tab.meta) }))} activeTab={status} onChange={setStatus} />

          <SearchToolbar
            searchSlot={(
              <label className="panel-subtle flex items-center gap-3 rounded-[18px] px-4 py-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by work order, client, title, or assigned user"
                  className="w-full bg-transparent text-sm text-app outline-none placeholder:text-muted"
                />
              </label>
            )}
            filters={(
              <>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="field-input">
                  <option value="All">All priorities</option>
                  {['Critical', 'High', 'Medium', 'Low'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={assignmentGroupFilter} onChange={(event) => setAssignmentGroupFilter(event.target.value)} className="field-input">
                  <option value="All">All groups</option>
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <select value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)} className="field-input">
                  <option value="All">All users</option>
                  {dispatchableUsers.map((user) => (
                    <option key={user.id} value={user.linkedTechnicianId}>{user.fullName}</option>
                  ))}
                </select>
              </>
            )}
            actions={(
              <label className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-app bg-[var(--app-surface)] px-4 text-sm text-muted">
                <input type="checkbox" checked={showUnassignedOnly} onChange={(event) => setShowUnassignedOnly(event.target.checked)} />
                Unassigned only
              </label>
            )}
          />

          {loading ? <LoadingState label="Loading work orders" /> : null}
          {!loading && error ? <ErrorState title="Unable to load work orders" description={error} /> : null}
          {!loading && !error ? (
            <DataTable
              rows={filteredRows}
              rowKey={(row) => row.id}
              pageSize={10}
              minTableWidth="min-w-[1120px] w-full"
              emptyTitle={hasWorkOrders ? 'No matching work orders' : 'No records yet'}
              emptyDescription={hasWorkOrders ? 'Adjust the filters or search text to see more results.' : 'Create the first work order for this branch scope to get started.'}
              mobileCard={(row) => (
                <div className="space-y-3 rounded-[24px] border border-app bg-[var(--app-card)] p-4 shadow-[var(--app-shadow-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/work-orders/${row.id}`} className="font-semibold text-accent-strong hover:underline">
                          {row.workOrderNumber}
                        </Link>
                        <Badge tone={statusTone(row.status as never)}>{row.status}</Badge>
                        {(row.slaResponseBreached || row.slaResolutionBreached) ? <Badge tone="danger">{row.slaStatus}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-app">{row.title}</p>
                      <p className="mt-1 text-xs text-muted">{row.clientName || 'No client'} | {row.branchName || 'No branch assigned'}</p>
                    </div>
                    <Badge tone={priorityTone(row.priority as 'Critical' | 'High' | 'Medium' | 'Low')}>{row.priority}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Asset" value={row.assetName || 'No asset linked'} />
                    <Detail label="Assigned group" value={resolveAssignedGroupName(row)} />
                    <Detail label="Assigned to" value={resolveAssignedToName(row)} />
                    <Detail label="Due date" value={formatDateOnly(row.dueDate || undefined)} />
                  </div>
                </div>
              )}
              columns={[
                {
                  key: 'workOrder',
                  header: 'Work Order',
                  cell: (row) => (
                    <div>
                      <Link to={`/work-orders/${row.id}`} className="font-semibold text-accent-strong hover:underline">
                        {row.workOrderNumber}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{row.title}</p>
                    </div>
                  ),
                },
                {
                  key: 'client',
                  header: 'Client / Site',
                  cell: (row) => (
                    <div>
                      <p>{row.clientName || 'No client'}</p>
                      <p className="mt-1 text-xs text-muted">{row.siteName || row.branchName || '—'}</p>
                    </div>
                  ),
                },
                {
                  key: 'asset',
                  header: 'Asset',
                  cell: (row) => <span>{row.assetName || 'No asset linked'}</span>,
                },
                { key: 'priority', header: 'Priority', cell: (row) => <Badge tone={priorityTone(row.priority as 'Critical' | 'High' | 'Medium' | 'Low')}>{row.priority}</Badge> },
                { key: 'status', header: 'Work Status', cell: (row) => <Badge tone={statusTone(row.status as never)}>{row.status}</Badge> },
                { key: 'sla', header: 'SLA', cell: (row) => <Badge tone={(row.slaResponseBreached || row.slaResolutionBreached) ? 'danger' : 'success'}>{row.slaStatus}</Badge> },
                {
                  key: 'assignedGroup',
                  header: 'Assigned Group',
                  cell: (row) => <span>{resolveAssignedGroupName(row)}</span>,
                },
                {
                  key: 'assignedTo',
                  header: 'Assigned To',
                  cell: (row) => <span>{resolveAssignedToName(row)}</span>,
                },
                { key: 'due', header: 'Due Date', cell: (row) => <span>{formatDateOnly(row.dueDate || undefined)}</span> },
              ]}
            />
          ) : null}
        </div>
      </SectionCard>

      <Modal
        open={editorOpen}
        title="Create work order"
        description="Capture the job details, assignment, and due date for this work order."
        onClose={() => setEditorOpen(false)}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <Field label="Client">
            <select
              value={form.clientId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  clientId: event.target.value,
                  siteId: '',
                  assetId: '',
                }))}
              className="field-input"
            >
              <option value="">Select a client</option>
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>{client.clientName}</option>
              ))}
            </select>
          </Field>
          <Field label="Site (optional)">
            <select
              value={form.siteId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  siteId: event.target.value,
                  assetId: '',
                }))}
              className="field-input"
              disabled={!form.clientId}
            >
              <option value="">{form.clientId ? 'No site selected' : 'Select a client first'}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.siteName}</option>
              ))}
            </select>
          </Field>
          <Field label="Asset (optional)">
            <select value={form.assetId} onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value }))} className="field-input">
              <option value="">No linked asset</option>
              {visibleAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.assetName}{asset.siteName ? ` — ${asset.siteName}` : ''}</option>
              ))}
            </select>
            <p className="text-xs text-muted">Assets are filtered by selected client and site. Leave blank for general or emergency requests.</p>
          </Field>
          <Field label="Assignment type">
            <select value={form.assignmentType} onChange={(event) => setForm((current) => ({ ...current, assignmentType: event.target.value as typeof current.assignmentType, assignedTechnicianIds: [], assignmentGroupId: '', leadTechnicianId: '', assignmentNotes: '' }))} className="field-input">
              <option value="IndividualTechnician">Assign to one User</option>
              <option value="MultipleTechnicians">Assign to multiple Users</option>
              <option value="AssignmentGroup">Assign to Group</option>
              <option value="Unassigned">Leave unassigned</option>
            </select>
          </Field>
          <Field label="Work order type">
            <select
              value={form.isPreventiveMaintenance ? 'PreventiveMaintenance' : 'CorrectiveMaintenance'}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isPreventiveMaintenance: event.target.value === 'PreventiveMaintenance',
                  pmTemplateId: event.target.value === 'PreventiveMaintenance' ? current.pmTemplateId : '',
                }))}
              className="field-input"
            >
              <option value="CorrectiveMaintenance">Corrective / General</option>
              <option value="PreventiveMaintenance">Preventive Maintenance</option>
            </select>
          </Field>
          {form.isPreventiveMaintenance ? (
            <Field label="PM Template">
              <select value={form.pmTemplateId} onChange={(event) => setForm((current) => ({ ...current, pmTemplateId: event.target.value }))} className="field-input">
                <option value="">{activePmTemplates.length === 0 ? 'No PM templates found' : 'Select PM template'}</option>
                {activePmTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              {activePmTemplates.length === 0 ? (
                <p className="text-xs text-amber-100">No PM templates found. Create a PM template before scheduling preventive maintenance.</p>
              ) : null}
            </Field>
          ) : null}
          {form.assignmentType === 'Unassigned' ? (
            <InfoAlert title="No assignment selected" description="This work order will be created without an assignment and will show as Unassigned until dispatch picks it up." tone="info" />
          ) : null}
          {form.assignmentType === 'IndividualTechnician' ? (
            <>
              <Field label="Assigned user">
                <select value={form.leadTechnicianId} onChange={(event) => setForm((current) => ({ ...current, leadTechnicianId: event.target.value }))} className="field-input">
                  <option value="">Select a user</option>
                  {dispatchableUsers.map((user) => (
                    <option key={user.id} value={user.linkedTechnicianId}>{user.fullName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Assignment notes">
                <textarea value={form.assignmentNotes} onChange={(event) => setForm((current) => ({ ...current, assignmentNotes: event.target.value }))} className="field-input min-h-[100px]" placeholder="Dispatch notes for the assigned user." />
              </Field>
            </>
          ) : null}
          {form.assignmentType === 'MultipleTechnicians' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-app">Search users</span>
                <input value={technicianQuery} onChange={(event) => setTechnicianQuery(event.target.value)} className="field-input" placeholder="Search by user name" />
              </label>
              <Field label="User selection">
                <div className="grid gap-2 rounded-2xl border border-app p-3">
                  {visibleUsers.map((user) => (
                    <label key={user.id} className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3">
                      <span className="text-sm text-app">{user.fullName}</span>
                      <input
                        type="checkbox"
                        checked={form.assignedTechnicianIds.includes(user.linkedTechnicianId)}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            assignedTechnicianIds: event.target.checked
                              ? [...current.assignedTechnicianIds, user.linkedTechnicianId]
                              : current.assignedTechnicianIds.filter((id) => id !== user.linkedTechnicianId),
                            leadTechnicianId: !event.target.checked && current.leadTechnicianId === user.linkedTechnicianId ? '' : current.leadTechnicianId,
                          }))}
                      />
                    </label>
                  ))}
                  {visibleUsers.length === 0 ? <div className="text-sm text-muted">No users match the current search.</div> : null}
                </div>
              </Field>
              <Field label="Lead user">
                <select value={form.leadTechnicianId} onChange={(event) => setForm((current) => ({ ...current, leadTechnicianId: event.target.value }))} className="field-input">
                  <option value="">Select lead user</option>
                  {dispatchableUsers
                    .filter((user) => Boolean(user.linkedTechnicianId && form.assignedTechnicianIds.includes(user.linkedTechnicianId)))
                    .map((user) => (
                      <option key={user.id} value={user.linkedTechnicianId}>{user.fullName}</option>
                    ))}
                </select>
              </Field>
              <Field label="Assignment notes">
                <textarea value={form.assignmentNotes} onChange={(event) => setForm((current) => ({ ...current, assignmentNotes: event.target.value }))} className="field-input min-h-[100px]" placeholder="Dispatch notes for the assigned users." />
              </Field>
            </>
          ) : null}
          {form.assignmentType === 'AssignmentGroup' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-app">Search groups</span>
                <input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} className="field-input" placeholder="Search by group name or skill area" />
              </label>
              <Field label="Assignment group">
                <select value={form.assignmentGroupId} onChange={(event) => setForm((current) => ({ ...current, assignmentGroupId: event.target.value, leadTechnicianId: '' }))} className="field-input">
                  <option value="">Select a group</option>
                  {visibleGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </Field>
              <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">
                <p className="font-medium text-app">{selectedGroup?.skillArea || 'Group skill area will appear here.'}</p>
                <p className="mt-2">{selectedGroup?.members.length ? `Members: ${selectedGroup.members.map((member) => member.memberName || 'User').join(', ')}` : 'Select a group to preview active members and coverage.'}</p>
              </div>
              <Field label="Lead user override">
                <select value={form.leadTechnicianId} onChange={(event) => setForm((current) => ({ ...current, leadTechnicianId: event.target.value }))} className="field-input">
                  <option value="">No override</option>
                  {groupMemberUsers.map((user) => (
                    <option key={user.id} value={user.linkedTechnicianId}>{user.fullName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Assignment notes">
                <textarea value={form.assignmentNotes} onChange={(event) => setForm((current) => ({ ...current, assignmentNotes: event.target.value }))} className="field-input min-h-[100px]" placeholder="Dispatch notes for the group queue." />
              </Field>
            </>
          ) : null}
          <Field label="Title">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="field-input" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="field-input min-h-[120px]" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Priority">
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="field-input">
                {['Critical', 'High', 'Medium', 'Low'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="field-input" />
            </Field>
          </div>
          {dispatchableUsers.length === 0 ? (
            <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">No workforce users are available for assignment in the current branch scope yet.</div>
          ) : null}
          {saveError ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{saveError}</div> : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="button-primary w-full sm:w-auto" onClick={() => void createWorkOrder()} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </PageScaffold>
  )
}

function resolveAssignedGroupName(workOrder: WorkOrder) {
  return workOrder.assignmentGroupName || 'No group'
}

function resolveAssignedToName(workOrder: WorkOrder) {
  const leadOrAssigned = workOrder.leadTechnicianName || workOrder.assignedTechnicianName
  if (leadOrAssigned) {
    return leadOrAssigned
  }

  const technicianNames = workOrder.technicianAssignments?.map((assignment) => assignment.technicianName).filter(Boolean) ?? []
  if (technicianNames.length > 0) {
    return technicianNames.join(', ')
  }

  return 'Unassigned'
}

function stringEquals(value: string | null | undefined, expected: string) {
  return value?.trim().toLowerCase() === expected.trim().toLowerCase()
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-app">{label}</span>
      {children}
    </label>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-app bg-[var(--app-surface)] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 break-words text-sm text-app">{value}</p>
    </div>
  )
}
