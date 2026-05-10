import { Download, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShellContext } from '../../components/layout/AppShell'
import { BulkImportModal } from '../../components/ui/BulkImportModal'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/ToastProvider'
import { MetricCard, MetricGrid, PageScaffold, SearchToolbar, SectionCard, StickyActionFooter } from '../../components/ui/Workspace'
import { useAsyncData } from '../../hooks/useAsyncData'
import { ApiError } from '../../lib/api'
import { assetService } from '../../services/assetService'
import { clientService } from '../../services/clientService'
import { importService } from '../../services/importService'
import type { AssetRecord, ClientRecord, UpsertAssetInput } from '../../types/api'
import { formatDateOnly } from '../../utils/date'

type AssetsPayload = {
  assets: AssetRecord[]
  clients: ClientRecord[]
}

type AssetFieldKey =
  | 'clientId'
  | 'assetName'
  | 'assetCode'
  | 'assetType'
  | 'installationDate'
  | 'warrantyExpiryDate'
  | 'lastPmDate'
  | 'nextPmDate'
  | 'status'

type AssetFieldErrors = Partial<Record<AssetFieldKey, string>>

const emptyPayload: AssetsPayload = { assets: [], clients: [] }
const emptyForm = (selectedBranchId: string): UpsertAssetInput => ({
  clientId: '',
  branchId: selectedBranchId === 'all' ? null : selectedBranchId,
  assetName: '',
  assetCode: '',
  assetType: '',
  location: '',
  serialNumber: '',
  manufacturer: '',
  model: '',
  installationDate: '',
  warrantyExpiryDate: '',
  recommendedPmFrequency: '',
  autoSchedulePm: true,
  lastPmDate: '',
  nextPmDate: '',
  notes: '',
  status: 'Active',
})

export function AssetsPage() {
  const { selectedBranchId } = useShellContext()
  const { pushToast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [editorOpen, setEditorOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<AssetRecord | null>(null)
  const [form, setForm] = useState<UpsertAssetInput>(emptyForm(selectedBranchId))
  const [saveError, setSaveError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AssetFieldErrors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const { data, loading, error, reload } = useAsyncData<AssetsPayload>(
    async (signal) => {
      const [assets, clients] = await Promise.all([
        assetService.list(selectedBranchId, signal, { search: debouncedSearch || undefined, status: statusFilter }),
        clientService.list({ signal, status: 'active' }),
      ])
      return { assets, clients }
    },
    emptyPayload,
    [debouncedSearch, selectedBranchId, statusFilter],
  )

  const hasFilters = useMemo(() => Boolean(debouncedSearch) || statusFilter !== 'active', [debouncedSearch, statusFilter])
  const activeAssetsCount = data.assets.filter((asset) => asset.status === 'Active').length
  const nextPmCount = data.assets.filter((asset) => Boolean(asset.nextPmDate)).length

  function openEditor(asset?: AssetRecord) {
    setEditing(asset ?? null)
    setSaveError('')
    setFieldErrors({})
    setForm({
      clientId: asset?.clientId ?? '',
      branchId: asset?.branchId ?? (selectedBranchId === 'all' ? null : selectedBranchId),
      assetName: asset?.assetName ?? '',
      assetCode: asset?.assetCode ?? '',
      assetType: asset?.assetType ?? '',
      location: asset?.location ?? '',
      serialNumber: asset?.serialNumber ?? '',
      manufacturer: asset?.manufacturer ?? '',
      model: asset?.model ?? '',
      installationDate: asset?.installationDate?.slice(0, 10) ?? '',
      warrantyExpiryDate: asset?.warrantyExpiryDate?.slice(0, 10) ?? '',
      recommendedPmFrequency: asset?.recommendedPmFrequency ?? '',
      autoSchedulePm: asset?.autoSchedulePm ?? true,
      lastPmDate: asset?.lastPmDate?.slice(0, 10) ?? '',
      nextPmDate: asset?.nextPmDate?.slice(0, 10) ?? '',
      notes: asset?.notes ?? '',
      status: asset?.status ?? 'Active',
    })
    setEditorOpen(true)
  }

  async function saveAsset() {
    if (saving) return

    setSaving(true)
    setSaveError('')
    setFieldErrors({})

    const nextFieldErrors: AssetFieldErrors = {}
    if (!form.clientId.trim()) {
      nextFieldErrors.clientId = 'Client is required.'
    }
    if (!form.assetName.trim()) {
      nextFieldErrors.assetName = 'Asset name is required.'
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSaveError('Please fix the highlighted asset fields and try again.')
      setSaving(false)
      return
    }

    try {
      if (editing) {
        await assetService.update(editing.id, form)
        pushToast({ title: 'Asset updated', description: 'The asset changes were saved.', tone: 'success' })
      } else {
        await assetService.create(form)
        pushToast({ title: 'Asset created', description: 'The new asset is now available in the register.', tone: 'success' })
      }
      setForm(emptyForm(selectedBranchId))
      setEditing(null)
      setEditorOpen(false)
      setFieldErrors({})
      await reload()
    } catch (error) {
      const { formError, fieldErrors: backendFieldErrors } = extractAssetErrors(error)
      setFieldErrors(backendFieldErrors)
      setSaveError(formError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageScaffold
        eyebrow="Assets"
        title="Asset register"
        description="Manage client assets, service details, and preventive maintenance dates."
        actions={
          <>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => assetService.downloadImportTemplate()}>
              <Download className="h-4 w-4" />
              Import template
            </button>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => setImportOpen(true)}>
              Bulk import
            </button>
            <button type="button" className="button-primary w-full sm:w-auto" onClick={() => openEditor()}>
              <Plus className="h-4 w-4" />
              Add asset
            </button>
          </>
        }
      >
      <MetricGrid className="xl:grid-cols-3">
        <MetricCard label="Assets in view" value={data.assets.length} meta={hasFilters ? 'Filtered asset register' : 'Current branch scope'} emphasis="accent" />
        <MetricCard label="Active assets" value={activeAssetsCount} meta={`${data.assets.length - activeAssetsCount} inactive`} />
        <MetricCard label="PM scheduled" value={nextPmCount} meta="Assets with next PM date" />
      </MetricGrid>

      <SectionCard title="Asset list" description="Keep serviceable equipment aligned to the correct client, location, and PM schedule.">
        <div className="space-y-4">
          <SearchToolbar
            searchSlot={(
              <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="w-full bg-transparent text-sm text-app outline-none placeholder:text-muted"
                  placeholder="Search by asset, tag, serial, make, model, client, or location"
                />
              </label>
            )}
            filters={<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="field-input">
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

          {loading ? <LoadingState label="Loading assets" /> : null}
          {!loading && error ? <ErrorState title="Unable to load assets" description={error} /> : null}
          {!loading && !error ? (
            <DataTable
            rows={data.assets}
            rowKey={(row) => row.id}
            pageSize={10}
            emptyTitle="No assets found"
            emptyDescription={hasFilters ? 'Try clearing search or changing status filters.' : 'Create an asset or import your asset list to get started.'}
            mobileCard={(row) => (
              <div className="space-y-3 rounded-[24px] border border-app bg-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-app">{row.assetName}</p>
                    <p className="mt-1 text-xs text-muted">{row.assetCode}</p>
                  </div>
                  <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>{row.status}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Client" value={row.clientName || 'Not linked'} />
                  <Detail label="Branch" value={row.branchName || 'Global'} />
                  <Detail label="Type" value={row.assetType || 'Not set'} />
                  <Detail label="Next PM" value={formatDateOnly(row.nextPmDate || undefined)} />
                </div>
                <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => openEditor(row)}>Edit asset</button>
              </div>
            )}
            columns={[
              {
                key: 'asset',
                header: 'Asset',
                cell: (row) => (
                  <div className={row.status === 'Inactive' ? 'opacity-70' : ''}>
                    <p className="font-semibold text-app">{row.assetName}</p>
                    <p className="mt-1 text-xs text-muted">{row.assetCode}</p>
                  </div>
                ),
              },
              { key: 'client', header: 'Client', cell: (row) => <span>{row.clientName || 'Not linked'}</span> },
              { key: 'branch', header: 'Branch', cell: (row) => <span>{row.branchName || 'Global'}</span> },
              { key: 'type', header: 'Type', cell: (row) => <span>{row.assetType || 'Not set'}</span> },
              { key: 'status', header: 'Status', cell: (row) => <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>{row.status}</Badge> },
              { key: 'pm', header: 'Next PM', cell: (row) => <span>{formatDateOnly(row.nextPmDate || undefined)}</span> },
              { key: 'actions', header: 'Actions', cell: (row) => <button type="button" className="button-secondary px-3 py-2" onClick={() => openEditor(row)}>Edit</button> },
            ]}
            />
          ) : null}
        </div>
      </SectionCard>

      <Modal open={editorOpen} title={editing ? 'Edit asset' : 'Add asset'} description="Capture the asset details needed for service and maintenance." onClose={() => setEditorOpen(false)} maxWidth="max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Client">
            <select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))} className="field-input">
              <option value="">Select client</option>
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>{client.clientName}</option>
              ))}
            </select>
            {fieldErrors.clientId ? <FieldError message={fieldErrors.clientId} /> : null}
          </Field>
          <Field label="Asset name">
            <input value={form.assetName} onChange={(event) => setForm((current) => ({ ...current, assetName: event.target.value }))} className="field-input" />
            {fieldErrors.assetName ? <FieldError message={fieldErrors.assetName} /> : null}
          </Field>
          <Field label="Asset code">
            <input value={form.assetCode || ''} onChange={(event) => setForm((current) => ({ ...current, assetCode: event.target.value }))} className="field-input" placeholder="Leave blank to auto-generate" />
            {fieldErrors.assetCode ? <FieldError message={fieldErrors.assetCode} /> : null}
          </Field>
          <Field label="Asset type">
            <input value={form.assetType || ''} onChange={(event) => setForm((current) => ({ ...current, assetType: event.target.value }))} className="field-input" />
            {fieldErrors.assetType ? <FieldError message={fieldErrors.assetType} /> : null}
          </Field>
          <Field label="Location"><input value={form.location || ''} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="field-input" /></Field>
          <Field label="Serial number"><input value={form.serialNumber || ''} onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))} className="field-input" /></Field>
          <Field label="Manufacturer"><input value={form.manufacturer || ''} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} className="field-input" /></Field>
          <Field label="Model"><input value={form.model || ''} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} className="field-input" /></Field>
          <Field label="Installation date">
            <input type="date" value={form.installationDate || ''} onChange={(event) => setForm((current) => ({ ...current, installationDate: event.target.value }))} className="field-input" />
            {fieldErrors.installationDate ? <FieldError message={fieldErrors.installationDate} /> : null}
          </Field>
          <Field label="Warranty expiry">
            <input type="date" value={form.warrantyExpiryDate || ''} onChange={(event) => setForm((current) => ({ ...current, warrantyExpiryDate: event.target.value }))} className="field-input" />
            {fieldErrors.warrantyExpiryDate ? <FieldError message={fieldErrors.warrantyExpiryDate} /> : null}
          </Field>
          <Field label="Recommended PM frequency"><input value={form.recommendedPmFrequency || ''} onChange={(event) => setForm((current) => ({ ...current, recommendedPmFrequency: event.target.value }))} className="field-input" placeholder="Monthly, Quarterly..." /></Field>
          <Field label="Next PM date">
            <input type="date" value={form.nextPmDate || ''} onChange={(event) => setForm((current) => ({ ...current, nextPmDate: event.target.value }))} className="field-input" />
            {fieldErrors.nextPmDate ? <FieldError message={fieldErrors.nextPmDate} /> : null}
          </Field>
        </div>
        <label className="panel-subtle mt-4 flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="text-sm text-app">Auto-schedule preventive maintenance</span>
          <input type="checkbox" checked={form.autoSchedulePm} onChange={(event) => setForm((current) => ({ ...current, autoSchedulePm: event.target.checked }))} />
        </label>
        <Field label="Notes"><textarea value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="field-input mt-4 min-h-[120px]" /></Field>
        {saveError ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{saveError}</div> : null}
        <StickyActionFooter className="mt-6">
          <button type="button" className="button-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void saveAsset()} disabled={saving}>{
            saving ? 'Saving asset...' : 'Save asset'
          }</button>
        </StickyActionFooter>
      </Modal>

      <BulkImportModal
        open={importOpen}
        title="Bulk import assets"
        description="Upload a CSV or Excel file to preview asset rows before importing them."
        onClose={() => setImportOpen(false)}
        onPreview={(file) => importService.previewAssets(file)}
        onCommit={(file) => importService.commitAssets(file)}
        onCommitted={async (summary) => {
          pushToast({
            title: 'Asset import complete',
            description: `Imported ${summary.successfulRows} of ${summary.totalRows} rows.`,
            tone: summary.failedRows > 0 ? 'warning' : 'success',
          })
          await reload()
        }}
      />
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

function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-rose-200">{message}</p>
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-app bg-app/20 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 break-words text-sm text-app">{value}</p>
    </div>
  )
}

function extractAssetErrors(error: unknown): { formError: string; fieldErrors: AssetFieldErrors } {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') {
    return {
      formError: error instanceof Error ? error.message : 'Unable to save asset.',
      fieldErrors: {},
    }
  }

  const record = error.details as Record<string, unknown>
  const errorMap = (record.errors && typeof record.errors === 'object' ? record.errors : {}) as Record<string, unknown>
  const fieldErrors: AssetFieldErrors = {}

  for (const [key, value] of Object.entries(errorMap)) {
    const firstMessage = Array.isArray(value) ? value.find((item) => typeof item === 'string') : null
    if (typeof firstMessage !== 'string' || !firstMessage.trim()) continue

    const normalizedKey = key.toLowerCase()
    if (normalizedKey.includes('clientid')) fieldErrors.clientId = firstMessage
    else if (normalizedKey.includes('assetname')) fieldErrors.assetName = firstMessage
    else if (normalizedKey.includes('assetcode')) fieldErrors.assetCode = firstMessage
    else if (normalizedKey.includes('assettype')) fieldErrors.assetType = firstMessage
    else if (normalizedKey.includes('installationdate')) fieldErrors.installationDate = firstMessage
    else if (normalizedKey.includes('warrantyexpirydate')) fieldErrors.warrantyExpiryDate = firstMessage
    else if (normalizedKey.includes('lastpmdate')) fieldErrors.lastPmDate = firstMessage
    else if (normalizedKey.includes('nextpmdate')) fieldErrors.nextPmDate = firstMessage
    else if (normalizedKey.includes('status')) fieldErrors.status = firstMessage
  }

  return {
    formError: error.message || 'Unable to save asset.',
    fieldErrors,
  }
}
