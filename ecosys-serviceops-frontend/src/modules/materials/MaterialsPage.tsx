import { ArrowDownToLine, ArrowUpFromLine, Download, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShellContext } from '../../components/layout/AppShell'
import { BulkImportModal } from '../../components/ui/BulkImportModal'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/ToastProvider'
import { useAsyncData } from '../../hooks/useAsyncData'
import { importService } from '../../services/importService'
import { materialService } from '../../services/materialService'
import type { MaterialItem, UpsertMaterialInput } from '../../types/api'
import { formatDateOnly } from '../../utils/date'

const emptyForm = (selectedBranchId: string): UpsertMaterialInput => ({
  itemCode: '',
  itemName: '',
  category: '',
  unitOfMeasure: 'pcs',
  quantityOnHand: 0,
  reorderLevel: 0,
  unitCost: null,
  branchId: selectedBranchId === 'all' ? null : selectedBranchId,
})

export function MaterialsPage() {
  const { selectedBranchId } = useShellContext()
  const { pushToast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [editorOpen, setEditorOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialItem | null>(null)
  const [movementMode, setMovementMode] = useState<'in' | 'out'>('in')
  const [movementTarget, setMovementTarget] = useState<MaterialItem | null>(null)
  const [movement, setMovement] = useState({ quantity: 1, reason: '', unitCost: '' })
  const [form, setForm] = useState<UpsertMaterialInput>(emptyForm(selectedBranchId))
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [movementError, setMovementError] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const { data, loading, error, reload } = useAsyncData<MaterialItem[]>(
    (signal) => materialService.list({ branchId: selectedBranchId, search: debouncedSearch || undefined, status: statusFilter, signal }),
    [],
    [debouncedSearch, selectedBranchId, statusFilter],
  )

  const hasFilters = useMemo(() => Boolean(debouncedSearch) || statusFilter !== 'active', [debouncedSearch, statusFilter])

  function openEditor(item?: MaterialItem) {
    setEditing(item ?? null)
    setSaveError('')
    setForm({
      itemCode: item?.itemCode ?? '',
      itemName: item?.itemName ?? '',
      category: item?.category ?? '',
      unitOfMeasure: item?.unitOfMeasure ?? 'pcs',
      quantityOnHand: item?.quantityOnHand ?? 0,
      reorderLevel: item?.reorderLevel ?? 0,
      unitCost: item?.unitCost ?? null,
      branchId: item?.branchId ?? (selectedBranchId === 'all' ? null : selectedBranchId),
    })
    setEditorOpen(true)
  }

  function openMovement(mode: 'in' | 'out', item: MaterialItem) {
    setMovementMode(mode)
    setMovementTarget(item)
    setMovement({ quantity: 1, reason: '', unitCost: '' })
    setMovementError('')
    setMovementOpen(true)
  }

  async function saveItem() {
    if (saving) return

    setSaving(true)
    setSaveError('')

    try {
      if (editing) {
        await materialService.update(editing.id, form)
        pushToast({ title: 'Material updated', description: 'Material item saved successfully.', tone: 'success' })
      } else {
        await materialService.create(form)
        pushToast({ title: 'Material created', description: 'New material item added successfully.', tone: 'success' })
      }
      setForm(emptyForm(selectedBranchId))
      setEditing(null)
      setEditorOpen(false)
      await reload()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save material item.')
    } finally {
      setSaving(false)
    }
  }

  async function submitMovement() {
    if (!movementTarget || moving) return

    setMoving(true)
    setMovementError('')

    try {
      if (movementMode === 'in') {
        await materialService.stockIn(movementTarget.id, {
          branchId: movementTarget.branchId ?? (selectedBranchId === 'all' ? null : selectedBranchId),
          quantity: movement.quantity,
          unitCost: movement.unitCost ? Number(movement.unitCost) : null,
          reason: movement.reason || 'Manual stock-in from frontend',
        })
      } else {
        await materialService.stockOut(movementTarget.id, {
          branchId: movementTarget.branchId ?? (selectedBranchId === 'all' ? null : selectedBranchId),
          quantity: movement.quantity,
          reason: movement.reason || 'Manual stock-out from frontend',
        })
      }
      pushToast({
        title: movementMode === 'in' ? 'Stock increased' : 'Stock reduced',
        description: 'Stock balances were updated successfully.',
        tone: 'success',
      })
      setMovementOpen(false)
      await reload()
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : 'Unable to post stock movement.')
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Materials"
        title="Materials and stock"
        description="Track stock levels, replenishment needs, and material movements."
        actions={
          <>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => materialService.downloadImportTemplate()}>
              <Download className="h-4 w-4" />
              Import template
            </button>
            <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => setImportOpen(true)}>
              Bulk import
            </button>
            <button type="button" className="button-primary w-full sm:w-auto" onClick={() => openEditor()}>
              <Plus className="h-4 w-4" />
              Add material
            </button>
          </>
        }
      />

      <section className="surface-card">
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="panel-subtle flex items-center gap-3 rounded-2xl px-4 py-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full bg-transparent text-sm text-app outline-none placeholder:text-muted"
              placeholder="Search by material, SKU, category, description, or UOM"
            />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="field-input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
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
        </div>

        {loading ? <LoadingState label="Loading materials" /> : null}
        {!loading && error ? <ErrorState title="Unable to load materials" description={error} /> : null}
        {!loading && !error ? (
          <DataTable
            rows={data}
            rowKey={(row) => row.id}
            pageSize={10}
            emptyTitle="No materials found"
            emptyDescription={hasFilters ? 'Try clearing search or changing status filters.' : 'Create a material item to start stock tracking.'}
            mobileCard={(row) => (
              <div className="space-y-3 rounded-[24px] border border-app bg-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-app">{row.itemName}</p>
                    <p className="mt-1 text-xs text-muted">{row.itemCode}</p>
                  </div>
                  <Badge tone={row.isLowStock ? 'warning' : 'success'}>{row.isLowStock ? 'Low' : 'Healthy'}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Branch" value={row.branchName || 'Global scope'} />
                  <Detail label="On Hand" value={`${row.quantityOnHand} ${row.unitOfMeasure}`} />
                  <Detail label="Reorder Level" value={String(row.reorderLevel)} />
                  <Detail label="Created" value={formatDateOnly(row.createdAt)} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => openEditor(row)}>Edit</button>
                  <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => openMovement('in', row)}>
                    <ArrowDownToLine className="h-4 w-4" />
                    Stock-in
                  </button>
                  <button type="button" className="button-secondary w-full sm:w-auto" onClick={() => openMovement('out', row)}>
                    <ArrowUpFromLine className="h-4 w-4" />
                    Stock-out
                  </button>
                </div>
              </div>
            )}
            columns={[
              {
                key: 'item',
                header: 'Item',
                cell: (row) => (
                  <div>
                    <p className="font-semibold text-app">{row.itemName}</p>
                    <p className="mt-1 text-xs text-muted">{row.itemCode}</p>
                  </div>
                ),
              },
              { key: 'branch', header: 'Branch', cell: (row) => <span>{row.branchName || 'Global scope'}</span> },
              { key: 'qty', header: 'On Hand', cell: (row) => <span>{row.quantityOnHand} {row.unitOfMeasure}</span> },
              { key: 'reorder', header: 'Reorder Level', cell: (row) => <span>{row.reorderLevel}</span> },
              { key: 'status', header: 'Stock', cell: (row) => <Badge tone={row.isLowStock ? 'warning' : 'success'}>{row.isLowStock ? 'Low' : 'Healthy'}</Badge> },
              { key: 'created', header: 'Created', cell: (row) => <span>{formatDateOnly(row.createdAt)}</span> },
              {
                key: 'actions',
                header: 'Actions',
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => openEditor(row)}>Edit</button>
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => openMovement('in', row)}>
                      <ArrowDownToLine className="h-4 w-4" />
                      Stock-in
                    </button>
                    <button type="button" className="button-secondary px-3 py-2" onClick={() => openMovement('out', row)}>
                      <ArrowUpFromLine className="h-4 w-4" />
                      Stock-out
                    </button>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </section>

      <Modal open={editorOpen} title={editing ? 'Edit material item' : 'Add material item'} description="Add or update a material item for stock tracking." onClose={() => setEditorOpen(false)} maxWidth="max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Item code"><input value={form.itemCode} onChange={(event) => setForm((current) => ({ ...current, itemCode: event.target.value }))} className="field-input" /></Field>
          <Field label="Item name"><input value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} className="field-input" /></Field>
          <Field label="Category"><input value={form.category || ''} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="field-input" /></Field>
          <Field label="Unit"><input value={form.unitOfMeasure} onChange={(event) => setForm((current) => ({ ...current, unitOfMeasure: event.target.value }))} className="field-input" /></Field>
          <Field label="Opening quantity"><input type="number" value={form.quantityOnHand} onChange={(event) => setForm((current) => ({ ...current, quantityOnHand: Number(event.target.value) || 0 }))} className="field-input" /></Field>
          <Field label="Reorder level"><input type="number" value={form.reorderLevel} onChange={(event) => setForm((current) => ({ ...current, reorderLevel: Number(event.target.value) || 0 }))} className="field-input" /></Field>
          <Field label="Unit cost"><input type="number" value={form.unitCost ?? ''} onChange={(event) => setForm((current) => ({ ...current, unitCost: event.target.value ? Number(event.target.value) : null }))} className="field-input" /></Field>
        </div>
        {saveError ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{saveError}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void saveItem()} disabled={saving}>{saving ? 'Saving item...' : 'Save item'}</button>
        </div>
      </Modal>

      <Modal open={movementOpen} title={movementMode === 'in' ? 'Stock-in' : 'Stock-out'} description="Record a stock movement for this item." onClose={() => setMovementOpen(false)} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="panel-subtle rounded-2xl p-4 text-sm text-muted">
            {movementTarget ? (
              <>
                <span className="font-medium text-app">{movementTarget.itemName}</span>
                <span> currently has </span>
                <span className="font-medium text-app">{movementTarget.quantityOnHand} {movementTarget.unitOfMeasure}</span>
                <span> on hand.</span>
              </>
            ) : null}
          </div>
          <Field label="Quantity">
            <input type="number" min={1} value={movement.quantity} onChange={(event) => setMovement((current) => ({ ...current, quantity: Number(event.target.value) || 1 }))} className="field-input" />
          </Field>
          {movementMode === 'in' ? (
            <Field label="Unit cost">
              <input type="number" value={movement.unitCost} onChange={(event) => setMovement((current) => ({ ...current, unitCost: event.target.value }))} className="field-input" />
            </Field>
          ) : null}
          <Field label="Reason">
            <textarea value={movement.reason} onChange={(event) => setMovement((current) => ({ ...current, reason: event.target.value }))} className="field-input min-h-[120px]" />
          </Field>
          {movementError ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{movementError}</div> : null}
          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setMovementOpen(false)} disabled={moving}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => void submitMovement()} disabled={moving}>{moving ? 'Posting...' : 'Post movement'}</button>
          </div>
        </div>
      </Modal>

      <BulkImportModal
        open={importOpen}
        title="Bulk import materials"
        description="Upload a CSV or Excel file to preview material rows before importing them."
        onClose={() => setImportOpen(false)}
        onPreview={(file) => importService.previewMaterials(file)}
        onCommit={(file) => importService.commitMaterials(file)}
        onCommitted={async (summary) => {
          pushToast({
            title: 'Material import complete',
            description: `Imported ${summary.successfulRows} of ${summary.totalRows} rows.`,
            tone: summary.failedRows > 0 ? 'warning' : 'success',
          })
          await reload()
        }}
      />
    </div>
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
      <p className="mt-1 break-words text-sm text-app">{value}</p>
    </div>
  )
}
