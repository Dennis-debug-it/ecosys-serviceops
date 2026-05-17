import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTenantData } from '../../app/useTenant'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { Drawer } from '../../components/ui/Drawer'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/ToastProvider'
import { inventoryService } from '../../services/inventoryService'
import type { InventoryAlert } from '../../types/app'
import { inventoryAlertTone, requisitionTone } from '../../utils/format'

export function InventoryPage() {
  const { tenantId, data } = useTenantData()
  const { pushToast } = useToast()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', sku: '', branchId: '', store: '', quantity: 0, reorderLevel: 0, unit: 'pcs' })
  const [adjustment, setAdjustment] = useState(0)
  const items = useMemo(
    () =>
      (data?.inventoryItems ?? [])
        .map((item) => ({ ...item, alert: deriveAlert(item.quantity, item.reorderLevel) }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [data?.inventoryItems],
  )
  const requisitions = useMemo(
    () => [...(data?.requisitions ?? [])].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
    [data?.requisitions],
  )

  if (!data) {
    return <EmptyState title="No inventory" description="Tenant data is unavailable." actionLabel="Refresh" />
  }

  const openEditor = (itemId?: string) => {
    const item = itemId ? data.inventoryItems.find((entry) => entry.id === itemId) : undefined
    setEditingId(item?.id ?? null)
    setForm({
      name: item?.name ?? '',
      sku: item?.sku ?? '',
      branchId: item?.branchId ?? data.branches[0]?.id ?? '',
      store: item?.store ?? '',
      quantity: item?.quantity ?? 0,
      reorderLevel: item?.reorderLevel ?? 0,
      unit: item?.unit ?? 'pcs',
    })
    setOpen(true)
  }

  const save = () => {
    if (editingId) {
      inventoryService.updateItem(tenantId, editingId, form)
      pushToast({ title: 'Inventory updated', description: 'Stock item updated successfully.', tone: 'success' })
    } else {
      inventoryService.addItem(tenantId, form)
      pushToast({ title: 'Inventory item added', description: 'New stock item is now available.', tone: 'success' })
    }
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Inventory"
        title="Materials and Requisitions"
        description="Manage stock, replenishment, adjustments, low-stock detection, and work order material issue."
        actions={
          <button type="button" className="button-primary" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            Add Stock Item
          </button>
        }
      />

      <section className="surface-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">Stock Register</p>
            <p className="text-sm text-muted">Low-stock badges are calculated from reorder levels.</p>
          </div>
          <Badge tone="warning">{items.filter((item) => item.alert !== 'Healthy').length} low stock</Badge>
        </div>
        <DataTable
          rows={items}
          rowKey={(row) => row.id}
          pageSize={8}
          columns={[
            { key: 'item', header: 'Item', cell: (row) => <div><p className="font-semibold text-app">{row.name}</p><p className="mt-1 text-xs text-muted">{row.sku}</p></div> },
            { key: 'qty', header: 'Quantity', cell: (row) => <p>{row.quantity} {row.unit}</p> },
            { key: 'store', header: 'Store', cell: (row) => <p>{row.store}</p> },
            { key: 'reorder', header: 'Reorder Level', cell: (row) => <p>{row.reorderLevel}</p> },
            { key: 'alert', header: 'Alert', cell: (row) => <Badge tone={inventoryAlertTone(row.alert)}>{row.alert}</Badge> },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="button-secondary px-3 py-2" onClick={() => openEditor(row.id)}>Edit</button>
                  <button type="button" className="button-secondary px-3 py-2" onClick={() => { setAdjustingId(row.id); setAdjustment(0) }}>Adjust</button>
                  <button type="button" className="button-secondary px-3 py-2" onClick={() => { inventoryService.replenish(tenantId, row.id, 1); pushToast({ title: 'Stock replenished', description: `${row.name} increased by 1.`, tone: 'success' }) }}>Stock-in +1</button>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section className="surface-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">Requisitions</p>
            <p className="text-sm text-muted">Material requests raised from work orders appear here.</p>
          </div>
          <Badge tone="info">{requisitions.length} total</Badge>
        </div>
        <DataTable
          rows={requisitions}
          rowKey={(row) => row.id}
          pageSize={8}
          emptyTitle="No requisitions yet"
          emptyDescription="Material requests from work orders will appear here."
          columns={[
            { key: 'req', header: 'Requisition', cell: (row) => <div><p className="font-semibold text-app">{row.requisitionNumber}</p><p className="mt-1 text-xs text-muted">{row.itemName}</p></div> },
            { key: 'qty', header: 'Requested', cell: (row) => <p>{row.quantityRequested}</p> },
            { key: 'issued', header: 'Issued', cell: (row) => <p>{row.quantityIssued}</p> },
            { key: 'store', header: 'Store', cell: (row) => <p>{row.store}</p> },
            { key: 'status', header: 'Status', cell: (row) => <Badge tone={requisitionTone(row.status)}>{row.status}</Badge> },
          ]}
        />
      </section>

      <Drawer open={open} title={editingId ? 'Edit stock item' : 'Add stock item'} description="Stock changes persist after refresh." onClose={() => setOpen(false)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Item name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="field-input" /></Field>
          <Field label="SKU"><input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} className="field-input" /></Field>
          <Field label="Branch">
            <select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} className="field-input">
              {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </Field>
          <Field label="Store"><input value={form.store} onChange={(event) => setForm((current) => ({ ...current, store: event.target.value }))} className="field-input" /></Field>
          <Field label="Quantity"><input type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) || 0 }))} className="field-input" /></Field>
          <Field label="Reorder level"><input type="number" value={form.reorderLevel} onChange={(event) => setForm((current) => ({ ...current, reorderLevel: Number(event.target.value) || 0 }))} className="field-input" /></Field>
        </div>
        <Field label="Unit"><input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className="field-input" /></Field>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="button-primary" onClick={save}>Save Item</button>
        </div>
      </Drawer>

      <Drawer open={Boolean(adjustingId)} title="Adjust stock" description="Positive values increase stock. Negative values reduce stock." onClose={() => setAdjustingId(null)}>
        <Field label="Adjustment quantity">
          <input type="number" value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value) || 0)} className="field-input" />
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setAdjustingId(null)}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => { if (adjustingId) { inventoryService.adjustStock(tenantId, adjustingId, adjustment); pushToast({ title: 'Stock adjusted', description: `Stock changed by ${adjustment}.`, tone: 'info' }) } setAdjustingId(null) }}>Apply Adjustment</button>
        </div>
      </Drawer>
    </div>
  )
}

function deriveAlert(quantity: number, reorderLevel: number): InventoryAlert {
  if (quantity <= 0 || quantity <= Math.max(1, Math.floor(reorderLevel / 2))) return 'Critical'
  if (quantity <= reorderLevel) return 'Low'
  return 'Healthy'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-app">{label}</span>
      {children}
    </label>
  )
}
