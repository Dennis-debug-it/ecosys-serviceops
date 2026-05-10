import { Ban, Eye, PencilLine, Plus, Power, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Drawer } from '../../components/ui/Drawer'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { InfoAlert } from '../../components/ui/InfoAlert'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/ToastProvider'
import { useAsyncData } from '../../hooks/useAsyncData'
import { platformLeadService } from '../../services/platformLeadService'
import { platformService, toServiceError } from '../../services/platformService'
import type { LicenseStatus, Tenant, TenantStatus } from '../../types/platform'
import { formatDateOnly, formatDateTime } from '../../utils/date'
import { getSlugValidationMessage, slugifyName } from '../../utils/slug'
import { Field, SectionTitle, licenseStatusBadge, tenantStatusBadge } from './PlatformCommon'
import { TenantCommunicationSettingsPanel } from './TenantCommunicationSettingsPanel'

const tenantStatuses: TenantStatus[] = ['Active', 'Trial', 'Suspended', 'Inactive']
const licenseStatuses: LicenseStatus[] = ['Active', 'Trial', 'Expired', 'Suspended']
const detailSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'branding', label: 'Branding' },
  { id: 'users', label: 'Users' },
  { id: 'modules', label: 'Modules' },
  { id: 'subscription', label: 'Subscription / Licensing' },
  { id: 'email-notifications', label: 'Email & Notifications' },
  { id: 'numbering', label: 'Numbering' },
  { id: 'templates', label: 'Templates' },
  { id: 'audit-trail', label: 'Audit Trail' },
  { id: 'danger-zone', label: 'Danger Zone' },
] as const

type DetailSectionId = (typeof detailSections)[number]['id']

const defaultTenantForm: Tenant = {
  tenantId: '',
  name: '',
  slug: '',
  contactPerson: '',
  contactEmail: '',
  plan: 'Starter',
  licenseStatus: 'Active',
  users: 0,
  branches: 0,
  status: 'Active',
  createdAt: '',
  maxUsers: 10,
  maxBranches: 2,
  trialEndDate: null,
  createDefaultAdmin: true,
  adminFullName: '',
  adminEmail: '',
}

export function PlatformTenantsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pushToast } = useToast()
  const { data, loading, error, reload } = useAsyncData(
    async () => platformService.tenantsApi.list(),
    { data: [] as Tenant[], backendAvailable: true, message: '' },
    [],
  )

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | TenantStatus>('All')
  const [planFilter, setPlanFilter] = useState('All')
  const [licenseFilter, setLicenseFilter] = useState<'All' | LicenseStatus>('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<Tenant>(defaultTenantForm)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [activeDetailSection, setActiveDetailSection] = useState<DetailSectionId>('overview')
  const [statusReason, setStatusReason] = useState('')
  const [pendingStatus, setPendingStatus] = useState<{ tenant: Tenant; nextStatus: TenantStatus } | null>(null)
  const [saving, setSaving] = useState(false)
  const [prefillLeadId, setPrefillLeadId] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

  const plans = useMemo(() => ['All', ...Array.from(new Set(data.data.map((item) => item.plan).filter(Boolean)))], [data.data])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.data.filter((item) => {
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.slug.toLowerCase().includes(query) ||
        item.contactEmail.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesPlan = planFilter === 'All' || item.plan === planFilter
      const matchesLicense = licenseFilter === 'All' || item.licenseStatus === licenseFilter
      return matchesQuery && matchesStatus && matchesPlan && matchesLicense
    })
  }, [data.data, search, statusFilter, planFilter, licenseFilter])

  function openCreate() {
    setMode('create')
    setForm(defaultTenantForm)
    setPrefillLeadId(null)
    setSlugTouched(false)
    setModalOpen(true)
  }

  function openEdit(tenant: Tenant) {
    setMode('edit')
    setForm(tenant)
    setSlugTouched(true)
    setModalOpen(true)
  }

  async function saveTenant() {
    if (!form.name.trim()) {
      pushToast({ title: 'Missing fields', description: 'Tenant name is required.', tone: 'warning' })
      return
    }

    if (mode === 'create' && form.createDefaultAdmin) {
      const adminName = (form.adminFullName || form.contactPerson || '').trim()
      const adminEmail = (form.adminEmail || form.contactEmail || '').trim()
      if (!adminName || !adminEmail) {
        pushToast({
          title: 'Admin details required',
          description: 'Contact person and contact email are required to create the first tenant admin and mail login credentials.',
          tone: 'warning',
        })
        return
      }
    }

    const normalizedSlug = slugifyName(form.slug)
    const slugError = getSlugValidationMessage(normalizedSlug)
    if (slugError) {
      pushToast({ title: 'Workspace URL name required', description: slugError, tone: 'warning' })
      return
    }

    setSaving(true)
    try {
      const payload = { ...form, slug: normalizedSlug }
      if (mode === 'create') {
        await platformService.tenantsApi.create(payload)
      } else {
        await platformService.tenantsApi.update(form.tenantId, payload)
      }
      pushToast({
        title: mode === 'create' ? 'Tenant created' : 'Tenant updated',
        description: mode === 'create' && form.createDefaultAdmin
          ? `${form.name} was created and initial admin credentials were queued for email delivery.`
          : `${form.name} saved successfully.`,
        tone: 'success',
      })
      setModalOpen(false)
      setPrefillLeadId(null)
      setSlugTouched(false)
      if (selectedTenant?.tenantId === form.tenantId) {
        setSelectedTenant((current) => (current ? { ...current, ...payload } : current))
      }
      await reload()
    } catch (saveError) {
      pushToast({ title: 'Save failed', description: toServiceError(saveError, 'Unable to save tenant.'), tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const leadId = searchParams.get('leadId')
    if (!leadId || modalOpen) return
    const requestedLeadId = leadId

    let cancelled = false

    async function preloadLead() {
      try {
        const lead = await platformLeadService.getLead(requestedLeadId)
        if (cancelled) return

        const generatedSlug = slugifyName(lead.companyName)

        setMode('create')
        setForm({
          ...defaultTenantForm,
          name: lead.companyName,
          slug: generatedSlug || defaultTenantForm.slug,
          contactPerson: lead.contactPersonName,
          contactEmail: lead.email,
          adminFullName: lead.contactPersonName,
          adminEmail: lead.email,
        })
        setSlugTouched(false)
        setPrefillLeadId(lead.id)
        setModalOpen(true)
        pushToast({
          title: 'Lead details loaded',
          description: `Review ${lead.companyName} and manually submit when you're ready to create the workspace.`,
          tone: 'success',
        })
      } catch (prefillError) {
        if (cancelled) return
        pushToast({
          title: 'Unable to load lead',
          description: prefillError instanceof Error ? prefillError.message : 'We could not prefill the workspace form from this lead.',
          tone: 'danger',
        })
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams)
          next.delete('leadId')
          setSearchParams(next, { replace: true })
        }
      }
    }

    void preloadLead()

    return () => {
      cancelled = true
    }
  }, [modalOpen, pushToast, searchParams, setSearchParams])

  async function changeStatus() {
    if (!pendingStatus) return
    if (pendingStatus.nextStatus !== 'Active' && !statusReason.trim()) {
      pushToast({ title: 'Reason required', description: 'Add a reason for suspension/deactivation.', tone: 'warning' })
      return
    }

    try {
      if (pendingStatus.nextStatus === 'Inactive') {
        await platformService.tenantsApi.deactivate(pendingStatus.tenant.tenantId, statusReason)
      } else if (pendingStatus.nextStatus === 'Active') {
        await platformService.tenantsApi.activate(pendingStatus.tenant.tenantId)
      } else {
        await platformService.tenantsApi.updateStatus(pendingStatus.tenant.tenantId, pendingStatus.nextStatus, statusReason)
      }

      pushToast({ title: 'Status updated', description: `${pendingStatus.tenant.name} is now ${pendingStatus.nextStatus}.`, tone: 'success' })
      setPendingStatus(null)
      setStatusReason('')
      await reload()
    } catch (updateError) {
      pushToast({ title: 'Update failed', description: toServiceError(updateError, 'Unable to update status.'), tone: 'danger' })
    }
  }

  return (
    <div data-testid="tenants-page" className="space-y-4">
      <PageHeader eyebrow="Platform Command Centre" title="Tenants" description="Onboard and manage tenants, licensing posture, and activation state." />

      {loading ? <LoadingState label="Loading tenants" /> : null}
      {!loading && error ? (
        <section className="surface-card space-y-3">
          <InfoAlert title="Unable to load tenants" description={error} tone="danger" />
          <button type="button" className="button-secondary" onClick={() => void reload()}><RefreshCw className="h-4 w-4" />Retry</button>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="surface-card space-y-4">
          <SectionTitle title="Tenant Directory" description="Search, filter, and execute tenant lifecycle actions." action={<button type="button" className="button-primary" onClick={openCreate}><Plus className="h-4 w-4" />Add Tenant</button>} />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3">
              <Search className="h-4 w-4 text-muted" />
              <input data-testid="tenants-search-input" value={search} onChange={(event) => setSearch(event.target.value)} className="bg-transparent text-sm text-app outline-none placeholder:text-muted" placeholder="Search by tenant name, slug, or email" />
            </label>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="field-input">
              <option value="All">All statuses</option>
              {tenantStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className="field-input">
              {plans.map((item) => <option key={item} value={item}>{item === 'All' ? 'All plans' : item}</option>)}
            </select>

            <select value={licenseFilter} onChange={(event) => setLicenseFilter(event.target.value as typeof licenseFilter)} className="field-input">
              <option value="All">All license states</option>
              {licenseStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? <EmptyState title="No tenants found" description="Adjust filters or create a new tenant." /> : (
            <DataTable
              rows={filtered}
              rowKey={(row) => row.tenantId}
              minTableWidth="min-w-[1320px] w-full"
              columns={[
                { key: 'name', header: 'Tenant Name', cell: (row) => <span className="font-semibold text-app">{row.name}</span> },
                { key: 'slug', header: 'Slug', cell: (row) => <span className="font-mono text-xs">{row.slug}</span> },
                { key: 'contact', header: 'Contact Person', cell: (row) => row.contactPerson || 'Not set' },
                { key: 'email', header: 'Contact Email', cell: (row) => row.contactEmail || 'Not set' },
                { key: 'plan', header: 'Plan', cell: (row) => row.plan },
                { key: 'license', header: 'License Status', cell: (row) => licenseStatusBadge(row.licenseStatus) },
                { key: 'users', header: 'Users', cell: (row) => String(row.users) },
                { key: 'branches', header: 'Branches', cell: (row) => String(row.branches) },
                { key: 'status', header: 'Status', cell: (row) => tenantStatusBadge(row.status) },
                { key: 'created', header: 'Created At', cell: (row) => formatDateOnly(row.createdAt) },
                {
                  key: 'actions',
                  header: 'Actions',
                  className: 'min-w-[320px]',
                  cell: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="button-secondary px-3 py-2" onClick={() => { setSelectedTenant(row); setActiveDetailSection('overview') }}><Eye className="h-4 w-4" />View</button>
                      <button type="button" className="button-secondary px-3 py-2" onClick={() => openEdit(row)}><PencilLine className="h-4 w-4" />Edit</button>
                      {row.status !== 'Active' ? <button type="button" className="button-secondary px-3 py-2" onClick={() => setPendingStatus({ tenant: row, nextStatus: 'Active' })}><Power className="h-4 w-4" />Activate</button> : null}
                      {row.status !== 'Suspended' ? <button type="button" className="button-secondary px-3 py-2" onClick={() => setPendingStatus({ tenant: row, nextStatus: 'Suspended' })}><Ban className="h-4 w-4" />Suspend</button> : null}
                      {row.status !== 'Inactive' ? <button type="button" className="button-secondary px-3 py-2" onClick={() => setPendingStatus({ tenant: row, nextStatus: 'Inactive' })}>Deactivate</button> : null}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </section>
      ) : null}

      <Modal open={modalOpen} title={mode === 'create' ? 'Add Tenant' : 'Edit Tenant'} description="Capture company profile, subscription, and access limits." onClose={() => !saving && setModalOpen(false)} maxWidth="max-w-5xl">
        {mode === 'create' && prefillLeadId ? (
          <div className="mb-4">
            <InfoAlert
              title="Prefilled from lead enquiry"
              description="Review these details carefully. Workspace creation is still a manual platform-owner action and will only happen when you submit this form."
              tone="info"
            />
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company Name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: slugTouched ? current.slug : slugifyName(event.target.value) }))} className="field-input" /></Field>
          <Field label="Workspace URL slug">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={form.slug} onChange={(event) => { setSlugTouched(true); setForm((current) => ({ ...current, slug: slugifyName(event.target.value) })) }} className="field-input font-mono" />
                <button type="button" className="button-secondary px-3 py-2" onClick={() => { setSlugTouched(false); setForm((current) => ({ ...current, slug: slugifyName(current.name) })) }}>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
              </div>
              <p className="text-xs text-muted">Auto-generated from the company name. You can edit it if needed.</p>
            </div>
          </Field>
          <Field label="Contact Person"><input value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} className="field-input" /></Field>
          <Field label="Contact Email"><input type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} className="field-input" /></Field>
          <Field label="Plan"><input value={String(form.plan)} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))} className="field-input" /></Field>
          <Field label="License State">
            <select value={form.licenseStatus} onChange={(event) => setForm((current) => ({ ...current, licenseStatus: event.target.value as LicenseStatus }))} className="field-input">
              {licenseStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TenantStatus }))} className="field-input">
              {tenantStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Max Users"><input type="number" min={1} value={form.maxUsers ?? ''} onChange={(event) => setForm((current) => ({ ...current, maxUsers: event.target.value ? Number(event.target.value) : null }))} className="field-input" /></Field>
          <Field label="Max Branches"><input type="number" min={1} value={form.maxBranches ?? ''} onChange={(event) => setForm((current) => ({ ...current, maxBranches: event.target.value ? Number(event.target.value) : null }))} className="field-input" /></Field>
          <Field label="Trial End Date"><input type="date" value={form.trialEndDate ? form.trialEndDate.slice(0, 10) : ''} onChange={(event) => setForm((current) => ({ ...current, trialEndDate: event.target.value || null }))} className="field-input" /></Field>
        </div>
        {mode === 'create' ? (
          <div className="mt-4 space-y-4">
            <label className="panel-subtle flex items-center justify-between rounded-2xl px-4 py-3">
              <span className="text-sm text-app">Create default tenant admin and email login credentials</span>
              <input
                type="checkbox"
                checked={form.createDefaultAdmin ?? true}
                onChange={(event) => setForm((current) => ({ ...current, createDefaultAdmin: event.target.checked }))}
              />
            </label>

            {form.createDefaultAdmin ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Initial Admin Full Name">
                  <input
                    value={form.adminFullName ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, adminFullName: event.target.value }))}
                    className="field-input"
                    placeholder={form.contactPerson || 'Tenant administrator'}
                  />
                </Field>
                <Field label="Initial Admin Email">
                  <input
                    type="email"
                    value={form.adminEmail ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))}
                    className="field-input"
                    placeholder={form.contactEmail || 'admin@company.com'}
                  />
                </Field>
              </div>
            ) : null}

            <InfoAlert
              title="Tenant onboarding credentials"
              description="When enabled, Ecosys will create the first tenant admin account and send login credentials to the admin email after workspace creation."
              tone="info"
            />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void saveTenant()} disabled={saving}>{saving ? 'Saving...' : mode === 'create' ? 'Create Tenant' : 'Save Changes'}</button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingStatus)} title="Update Tenant Status" description="Suspended means temporary blocked access. Deactivated means tenant is inactive." onClose={() => setPendingStatus(null)}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Tenant: <span className="font-semibold text-app">{pendingStatus?.tenant.name}</span>
          </p>
          <Field label="Reason">
            <textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} className="field-input min-h-[120px]" placeholder="Add reason for this action" />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setPendingStatus(null)}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => void changeStatus()}>Apply</button>
          </div>
        </div>
      </Modal>

      <Drawer open={Boolean(selectedTenant)} title={selectedTenant?.name || 'Tenant'} description="Tenant profile and current controls." onClose={() => { setSelectedTenant(null); setActiveDetailSection('overview') }}>
        {selectedTenant ? (
          <div data-testid="tenant-details-page" className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <aside data-testid="tenant-details-mini-sidebar" className="surface-card h-max space-y-2 p-3">
              {detailSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  data-testid={`tenant-details-section-${section.id}`}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${activeDetailSection === section.id ? 'bg-accent/20 text-accent-strong' : 'text-muted hover:bg-app/60 hover:text-app'}`}
                  onClick={() => setActiveDetailSection(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </aside>

            <div className="space-y-4">
              {activeDetailSection === 'overview' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Detail label="Tenant Name" value={selectedTenant.name} />
                  <Detail label="Slug" value={selectedTenant.slug} />
                  <Detail label="Contact Person" value={selectedTenant.contactPerson || 'Not set'} />
                  <Detail label="Contact Email" value={selectedTenant.contactEmail || 'Not set'} />
                  <Detail label="Plan" value={String(selectedTenant.plan)} />
                  <Detail label="License Status" value={selectedTenant.licenseStatus} />
                  <Detail label="Status" value={selectedTenant.status} />
                  <Detail label="Users" value={String(selectedTenant.users)} />
                  <Detail label="Branches" value={String(selectedTenant.branches)} />
                  <Detail label="Created At" value={formatDateTime(selectedTenant.createdAt)} />
                </div>
              ) : null}

              {activeDetailSection === 'email-notifications' ? (
                <TenantCommunicationSettingsPanel
                  tenant={selectedTenant}
                  onToast={({ title, description, tone }) => pushToast({ title, description, tone })}
                />
              ) : null}

              {activeDetailSection !== 'overview' && activeDetailSection !== 'email-notifications' ? (
                <div className="surface-card">
                  <p className="text-lg font-semibold text-app">{detailSections.find((item) => item.id === activeDetailSection)?.label}</p>
                  <p className="mt-2 text-sm text-muted">This section will be enabled in a follow-up sprint. Existing tenant workflows are unchanged.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-subtle rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm text-app">{value}</p>
    </div>
  )
}
