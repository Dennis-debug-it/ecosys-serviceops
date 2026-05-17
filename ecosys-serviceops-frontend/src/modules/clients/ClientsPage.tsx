import { MapPin, Paperclip, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AttachmentPanel } from '../../components/ui/AttachmentPanel'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { Drawer } from '../../components/ui/Drawer'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/ToastProvider'
import { MetricCard, MetricGrid, PageScaffold, SearchToolbar, SectionCard, StickyActionFooter } from '../../components/ui/Workspace'
import { useAsyncData } from '../../hooks/useAsyncData'
import { attachmentService, ATTACHMENT_ENTITY_TYPES } from '../../services/attachmentService'
import { clientService } from '../../services/clientService'
import { slaService } from '../../services/slaService'
import { siteService } from '../../services/siteService'
import type { AttachmentRecord, ClientRecord, SiteRecord, SlaDefinitionRecord, UpsertClientInput, UpsertSiteInput } from '../../types/api'
import { formatDateOnly } from '../../utils/date'

type ClientStatusFilter = 'active' | 'inactive' | 'all'
type ClientWorkflowForm = UpsertClientInput

const emptySiteForm: UpsertSiteInput = {
  siteName: '',
  siteType: 'Branch',
  streetAddress: '',
  areaEstate: '',
  townCity: '',
  county: '',
  country: '',
  region: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  alternateContact: '',
  operatingHours: '',
  accessNotes: '',
  specialInstructions: '',
}

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
    slaDefinitionId: '',
    notes: '',
  })
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>('active')
  const [actionClientId, setActionClientId] = useState<string | null>(null)
  const [sitesClient, setSitesClient] = useState<ClientRecord | null>(null)
  const [sitesDrawerOpen, setSitesDrawerOpen] = useState(false)
  const [siteEditorOpen, setSiteEditorOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<SiteRecord | null>(null)
  const [siteForm, setSiteForm] = useState<UpsertSiteInput>(emptySiteForm)
  const [docsClient, setDocsClient] = useState<ClientRecord | null>(null)
  const [clientAttachments, setClientAttachments] = useState<AttachmentRecord[]>([])

  const { data: sites, loading: sitesLoading, error: sitesError, reload: reloadSites } = useAsyncData<SiteRecord[]>(
    (signal) => sitesClient ? siteService.list(sitesClient.id, { signal }) : Promise.resolve([]),
    [],
    [sitesClient?.id],
  )

  const { data: slaDefinitions } = useAsyncData<SlaDefinitionRecord[]>(
    (signal) => slaService.list(signal),
    [],
    [],
  )

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

  useEffect(() => {
    if (!docsClient) { setClientAttachments([]); return }
    let active = true
    attachmentService.list(ATTACHMENT_ENTITY_TYPES.Client, docsClient.id)
      .then((result) => { if (active) setClientAttachments(result) })
      .catch(() => { if (active) setClientAttachments([]) })
    return () => { active = false }
  }, [docsClient])
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
      slaDefinitionId: client?.slaDefinitionId ?? '',
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

  function openSites(client: ClientRecord) {
    setSitesClient(client)
    setSitesDrawerOpen(true)
    setSiteEditorOpen(false)
  }

  function openSiteEditor(site?: SiteRecord) {
    setEditingSite(site ?? null)
    setSiteForm(site ? {
      siteName: site.siteName,
      siteType: site.siteType,
      streetAddress: site.streetAddress ?? '',
      areaEstate: site.areaEstate ?? '',
      townCity: site.townCity ?? '',
      county: site.county ?? '',
      country: site.country ?? '',
      region: site.region ?? '',
      contactPerson: site.contactPerson ?? '',
      contactPhone: site.contactPhone ?? '',
      contactEmail: site.contactEmail ?? '',
      alternateContact: site.alternateContact ?? '',
      operatingHours: site.operatingHours ?? '',
      accessNotes: site.accessNotes ?? '',
      specialInstructions: site.specialInstructions ?? '',
    } : emptySiteForm)
    setSiteEditorOpen(true)
  }

  async function saveSite() {
    if (!sitesClient) return
    try {
      if (editingSite) {
        await siteService.update(sitesClient.id, editingSite.id, siteForm)
        pushToast({ title: 'Site updated', description: 'Site details saved successfully.', tone: 'success' })
      } else {
        await siteService.create(sitesClient.id, siteForm)
        pushToast({ title: 'Site added', description: 'New site created for this client.', tone: 'success' })
      }
      setSiteEditorOpen(false)
      await reloadSites()
    } catch (err) {
      pushToast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Unable to save site.', tone: 'danger' })
    }
  }

  async function deactivateSite(site: SiteRecord) {
    if (!sitesClient) return
    const confirmed = window.confirm(`Deactivate site "${site.siteName}"?`)
    if (!confirmed) return
    try {
      await siteService.deactivate(sitesClient.id, site.id)
      pushToast({ title: 'Site deactivated', description: 'Site is now inactive.', tone: 'success' })
      await reloadSites()
    } catch (err) {
      pushToast({ title: 'Failed', description: err instanceof Error ? err.message : 'Unable to deactivate site.', tone: 'danger' })
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
                  <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => openSites(row)}>Sites</button>
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
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => openSites(row)}>
                      <MapPin className="h-3.5 w-3.5" />
                      Sites
                    </button>
                    <button type="button" className="button-secondary px-3 py-2" title="Documents" onClick={() => setDocsClient(row)} data-testid={`client-docs-btn-${row.id}`}>
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
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
          <Field label="Response targets">
            <select value={form.slaDefinitionId || ''} onChange={(event) => setForm((current) => ({ ...current, slaDefinitionId: event.target.value || null }))} className="field-input">
              <option value="">No response target set</option>
              {slaDefinitions.filter((item) => item.isActive).map((definition) => (
                <option key={definition.id} value={definition.id}>{definition.planName}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="field-input mt-4 min-h-[120px]" /></Field>
        <StickyActionFooter className="mt-6">
          <button type="button" className="button-secondary" onClick={() => setDrawerOpen(false)}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void saveClient()}>Save client</button>
        </StickyActionFooter>
      </Drawer>

      <Drawer
        open={sitesDrawerOpen}
        title={sitesClient ? `Sites — ${sitesClient.clientName}` : 'Sites'}
        description="Manage physical locations and sites for this client."
        onClose={() => { setSitesDrawerOpen(false); setSiteEditorOpen(false) }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted">{sites.length} site{sites.length !== 1 ? 's' : ''}</p>
          <button type="button" className="button-primary" onClick={() => openSiteEditor()}>
            <Plus className="h-4 w-4" />
            Add site
          </button>
        </div>

        {sitesLoading && <LoadingState label="Loading sites" />}
        {!sitesLoading && sitesError && <ErrorState title="Unable to load sites" description={sitesError} />}
        {!sitesLoading && !sitesError && sites.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No sites yet. Add the first site for this client.</p>
        )}
        {!sitesLoading && !sitesError && sites.map((site) => (
          <div key={site.id} className="mb-3 rounded-2xl border border-app bg-subtle p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-app">{site.siteName}</p>
                <p className="text-xs text-muted">{site.siteCode} · {site.siteType}</p>
              </div>
              <Badge tone={site.status === 'Active' ? 'success' : 'neutral'}>{site.status}</Badge>
            </div>
            {(site.townCity || site.county || site.country) && (
              <p className="text-sm text-muted">{[site.townCity, site.county, site.country].filter(Boolean).join(', ')}</p>
            )}
            {site.contactPerson && (
              <p className="text-xs text-muted">Contact: {site.contactPerson}{site.contactPhone ? ` · ${site.contactPhone}` : ''}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => openSiteEditor(site)}>Edit</button>
              {site.status === 'Active' && (
                <button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => void deactivateSite(site)}>Deactivate</button>
              )}
            </div>
          </div>
        ))}

        {siteEditorOpen && (
          <div className="mt-6 border-t border-app pt-6">
            <h3 className="mb-4 text-sm font-semibold text-app">{editingSite ? 'Edit site' : 'New site'}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Site name"><input value={siteForm.siteName} onChange={(e) => setSiteForm((f) => ({ ...f, siteName: e.target.value }))} className="field-input" /></Field>
              <Field label="Site type">
                <select value={siteForm.siteType ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, siteType: e.target.value }))} className="field-input">
                  <option value="Branch">Branch</option>
                  <option value="Depot">Depot</option>
                  <option value="Office">Office</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Remote">Remote</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Street address"><input value={siteForm.streetAddress ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, streetAddress: e.target.value }))} className="field-input" /></Field>
              <Field label="Area / Estate"><input value={siteForm.areaEstate ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, areaEstate: e.target.value }))} className="field-input" /></Field>
              <Field label="Town / City"><input value={siteForm.townCity ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, townCity: e.target.value }))} className="field-input" /></Field>
              <Field label="County"><input value={siteForm.county ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, county: e.target.value }))} className="field-input" /></Field>
              <Field label="Country"><input value={siteForm.country ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, country: e.target.value }))} className="field-input" /></Field>
              <Field label="Region"><input value={siteForm.region ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, region: e.target.value }))} className="field-input" /></Field>
              <Field label="Contact person"><input value={siteForm.contactPerson ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, contactPerson: e.target.value }))} className="field-input" /></Field>
              <Field label="Contact phone"><input value={siteForm.contactPhone ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, contactPhone: e.target.value }))} className="field-input" /></Field>
              <Field label="Contact email"><input value={siteForm.contactEmail ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, contactEmail: e.target.value }))} className="field-input" /></Field>
              <Field label="Operating hours"><input value={siteForm.operatingHours ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, operatingHours: e.target.value }))} className="field-input" /></Field>
            </div>
            <Field label="Access notes"><textarea value={siteForm.accessNotes ?? ''} onChange={(e) => setSiteForm((f) => ({ ...f, accessNotes: e.target.value }))} className="field-input mt-3 min-h-[80px]" /></Field>
            <StickyActionFooter className="mt-4">
              <button type="button" className="button-secondary" onClick={() => setSiteEditorOpen(false)}>Cancel</button>
              <button type="button" className="button-primary" onClick={() => void saveSite()}>Save site</button>
            </StickyActionFooter>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(docsClient)}
        title={`Documents — ${docsClient?.clientName ?? ''}`}
        description="Upload and manage files attached to this client."
        onClose={() => setDocsClient(null)}
        maxWidth="max-w-2xl"
      >
        {docsClient ? (
          <AttachmentPanel
            entityType={ATTACHMENT_ENTITY_TYPES.Client}
            entityId={docsClient.id}
            attachments={clientAttachments}
            onUploaded={(a) => setClientAttachments((prev) => [...prev, a])}
            onDeleted={(id) => setClientAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
        ) : null}
      </Modal>
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
