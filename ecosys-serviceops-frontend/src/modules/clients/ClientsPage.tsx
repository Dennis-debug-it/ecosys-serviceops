import { Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { Drawer } from '../../components/ui/Drawer'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { useToast } from '../../components/ui/ToastProvider'
import { MetricCard, MetricGrid, PageScaffold, SearchToolbar, SectionCard, StickyActionFooter } from '../../components/ui/Workspace'
import { useAsyncData } from '../../hooks/useAsyncData'
import { clientService } from '../../services/clientService'
import type { ClientRecord, UpsertClientInput } from '../../types/api'
import { formatDateOnly } from '../../utils/date'

type ClientStatusFilter = 'active' | 'inactive' | 'all'
type ClientWorkflowForm = Omit<UpsertClientInput, 'slaPlan'>

export function ClientsPage() {
  const { pushToast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ClientRecord | null>(null)
  const [form, setForm] = useState<ClientWorkflowForm>({
    clientName: '',
    clientType: '',
    email: '',
    phone: '',
    location: '',
    contactPerson: '',
    contactPhone: '',
    notes: '',
  })
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>('active')
  const [actionClientId, setActionClientId] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const { data, loading, error, reload } = useAsyncData<ClientRecord[]>(
    (signal) => clientService.list({ signal, search: debouncedSearch || undefined, status: statusFilter }),
    [],
    [debouncedSearch, statusFilter],
  )

  const hasFilters = useMemo(() => Boolean(debouncedSearch) || statusFilter !== 'active', [debouncedSearch, statusFilter])
  const activeClientsCount = data.filter((client) => client.isActive).length
  const inactiveClientsCount = data.filter((client) => !client.isActive).length

  function openEditor(client?: ClientRecord) {
    setEditing(client ?? null)
    setForm({
      clientName: client?.clientName ?? '',
      clientType: client?.clientType ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      location: client?.location ?? '',
      contactPerson: client?.contactPerson ?? '',
      contactPhone: client?.contactPhone ?? '',
      notes: client?.notes ?? '',
    })
    setDrawerOpen(true)
  }

  async function saveClient() {
    try {
      if (editing) {
        await clientService.update(editing.id, form)
        pushToast({ title: 'Client updated', description: 'Client details were saved successfully.', tone: 'success' })
      } else {
        await clientService.create(form)
        pushToast({ title: 'Client created', description: 'The new client is ready to use.', tone: 'success' })
      }
      setDrawerOpen(false)
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Save failed', description: nextError instanceof Error ? nextError.message : 'Unable to save client.', tone: 'danger' })
    }
  }

  async function toggleClientStatus(client: ClientRecord) {
    if (!client.isActive) {
      try {
        setActionClientId(client.id)
        await clientService.activate(client.id)
        pushToast({ title: 'Client activated', description: 'Client is active again.', tone: 'success' })
        await reload()
      } catch (nextError) {
        pushToast({ title: 'Activation failed', description: nextError instanceof Error ? nextError.message : 'Unable to activate client.', tone: 'danger' })
      } finally {
        setActionClientId(null)
      }
      return
    }

    const confirmed = window.confirm('Deactivating this client will also deactivate all linked assets. Historical work orders will remain available. Continue?')
    if (!confirmed) {
      return
    }

    try {
      setActionClientId(client.id)
      await clientService.deactivate(client.id)
      pushToast({ title: 'Client deactivated', description: 'Linked assets were deactivated and historical records were preserved.', tone: 'success' })
      await reload()
    } catch (nextError) {
      pushToast({ title: 'Deactivation failed', description: nextError instanceof Error ? nextError.message : 'Unable to deactivate client.', tone: 'danger' })
    } finally {
      setActionClientId(null)
    }
  }

  return (
    <PageScaffold
      eyebrow="Clients"
      title="Client register"
      description="Search, filter, and manage active or inactive client accounts."
      actions={
        <button type="button" className="button-primary w-full sm:w-auto" onClick={() => openEditor()}>
          <Plus className="h-4 w-4" />
          Add client
        </button>
      }
    >
      <MetricGrid className="xl:grid-cols-3">
        <MetricCard label="Active clients" value={activeClientsCount} meta="Ready for service operations" emphasis="accent" />
        <MetricCard label="Inactive clients" value={inactiveClientsCount} meta="Retained for historical records" />
        <MetricCard label="Current result set" value={data.length} meta={hasFilters ? 'Filtered register view' : 'Full active register view'} />
      </MetricGrid>

      <SectionCard title="Client list" description="Use the register and side drawer workflow to maintain company details safely.">
        <div className="space-y-4">
          <SearchToolbar
            searchSlot={(
              <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="w-full bg-transparent text-sm text-app outline-none placeholder:text-muted"
                  placeholder="Search by client, contact, email, phone, or location"
                />
              </label>
            )}
            filters={<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ClientStatusFilter)} className="field-input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>}
            actions={(
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setSearchInput('')
                  setDebouncedSearch('')
                  setStatusFilter('active')
                }}
                disabled={!hasFilters}
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          />

          {loading ? <LoadingState label="Loading clients" /> : null}
          {!loading && error ? <ErrorState title="Unable to load clients" description={error} /> : null}
          {!loading && !error ? (
            <DataTable
            rows={data}
            rowKey={(row) => row.id}
            pageSize={10}
            emptyTitle={hasFilters ? 'No clients found' : 'No clients found'}
            emptyDescription={hasFilters ? 'Try clearing search or changing the status filter.' : 'Create the first client record to link work orders and assets.'}
            mobileCard={(row) => (
              <div className="space-y-3 rounded-[24px] border border-app bg-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-semibold ${row.isActive ? 'text-app' : 'text-muted'}`}>{row.clientName}</p>
                    <p className="mt-1 text-xs text-muted">{row.clientType || 'Client'}</p>
                  </div>
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Contact" value={row.contactPerson || row.email || 'Not set'} />
                  <Detail label="Phone" value={row.contactPhone || row.phone || 'Not set'} />
                  <Detail label="Location" value={row.location || 'Not set'} />
                  <Detail label="Created" value={formatDateOnly(row.createdAt)} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => openEditor(row)}>Edit</button>
                  <button
                    type="button"
                    className="button-secondary w-full sm:w-auto"
                    onClick={() => void toggleClientStatus(row)}
                    disabled={actionClientId === row.id}
                  >
                    {actionClientId === row.id ? 'Saving...' : row.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )}
            columns={[
              {
                key: 'name',
                header: 'Client',
                cell: (row) => (
                  <div className={row.isActive ? '' : 'opacity-70'}>
                    <p className={`font-semibold ${row.isActive ? 'text-app' : 'text-muted'}`}>{row.clientName}</p>
                    <p className="mt-1 text-xs text-muted">{row.clientType || 'Client'}</p>
                  </div>
                ),
              },
              { key: 'status', header: 'Status', cell: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
              { key: 'contact', header: 'Contact', cell: (row) => <span>{row.contactPerson || row.email || 'Not set'}</span> },
              { key: 'phone', header: 'Phone', cell: (row) => <span>{row.contactPhone || row.phone || 'Not set'}</span> },
              { key: 'location', header: 'Location', cell: (row) => <span>{row.location || 'Not set'}</span> },
              { key: 'created', header: 'Created', cell: (row) => <span>{formatDateOnly(row.createdAt)}</span> },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => openEditor(row)}>Edit</button>
                    <button
                      type="button"
                      className="button-secondary px-3 py-2"
                      onClick={() => void toggleClientStatus(row)}
                      disabled={actionClientId === row.id}
                    >
                      {actionClientId === row.id ? 'Saving...' : row.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ),
              },
            ]}
            />
          ) : null}
        </div>
      </SectionCard>

      <Drawer open={drawerOpen} title={editing ? 'Edit client' : 'Add client'} description="Keep client details up to date for operations and support." onClose={() => setDrawerOpen(false)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Client name"><input value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} className="field-input" /></Field>
          <Field label="Client type"><input value={form.clientType || ''} onChange={(event) => setForm((current) => ({ ...current, clientType: event.target.value }))} className="field-input" /></Field>
          <Field label="Email"><input value={form.email || ''} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="field-input" /></Field>
          <Field label="Phone"><input value={form.phone || ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="field-input" /></Field>
          <Field label="Contact person"><input value={form.contactPerson || ''} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} className="field-input" /></Field>
          <Field label="Contact phone"><input value={form.contactPhone || ''} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} className="field-input" /></Field>
          <Field label="Location"><input value={form.location || ''} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="field-input" /></Field>
        </div>
        <Field label="Notes"><textarea value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="field-input mt-4 min-h-[120px]" /></Field>
        <StickyActionFooter className="mt-6">
          <button type="button" className="button-secondary" onClick={() => setDrawerOpen(false)}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void saveClient()}>Save client</button>
        </StickyActionFooter>
      </Drawer>
    </PageScaffold>
  )
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
    <div className="rounded-2xl border border-app bg-app/20 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 text-sm text-app">{value}</p>
    </div>
  )
}
