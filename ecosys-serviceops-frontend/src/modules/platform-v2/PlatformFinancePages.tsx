import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { FileText, Receipt, RefreshCw, Wallet } from 'lucide-react'
import { DataTable } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { InfoAlert } from '../../components/ui/InfoAlert'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useToast } from '../../components/ui/ToastProvider'
import { useAsyncData } from '../../hooks/useAsyncData'
import { platformService, toServiceError } from '../../services/platformService'
import type { Invoice, PaymentMethod, PaymentStatus, Quotation } from '../../types/platform'
import { formatDateOnly } from '../../utils/date'
import { Field, SectionTitle, TabLinks } from './PlatformCommon'

const financeTabs = [
  { label: 'Dashboard', to: '/platform/finance' },
  { label: 'Quotations', to: '/platform/finance/quotations' },
  { label: 'Invoices', to: '/platform/finance/invoices' },
  { label: 'Payments', to: '/platform/finance/payments' },
  { label: 'Revenue', to: '/platform/finance/revenue' },
  { label: 'Expenses', to: '/platform/finance/expenses' },
  { label: 'Tax Settings', to: '/platform/finance/tax-settings' },
  { label: 'Document Templates', to: '/platform/finance/templates' },
]

function useFinanceState() {
  return useAsyncData(
    async () => platformService.financeApi.getAll(),
    { data: { quotations: [], invoices: [], payments: [], expenses: [], taxSetting: { name: 'VAT', defaultRate: 16, mode: 'Exclusive' }, templates: [] }, backendAvailable: true, message: '' },
    [],
  )
}

export function PlatformFinancePage() {
  const location = useLocation()
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Platform Command Centre" title="Finance" description="Billing, collections, revenue, and spending in one module." />
      <TabLinks links={financeTabs} />
      {location.pathname === '/platform/finance' ? <FinanceDashboard /> : <Outlet />}
    </div>
  )
}

function FinanceDashboard() {
  const { data, loading, error, reload } = useAsyncData(
    async () => platformService.financeApi.getSummary(),
    { data: { totalRevenue: 0, outstandingInvoices: 0, overdueInvoices: 0, expensesThisMonth: 0, profitEstimate: 0, quotationConversionRate: 0, recentPayments: [], recentInvoices: [], overdueAccounts: [] }, backendAvailable: true, message: '' },
    [],
  )

  return (
    <div className="space-y-4">
      {loading ? <LoadingState label="Loading finance dashboard" /> : null}
      {!loading && error ? (
        <section className="surface-card space-y-3">
          <InfoAlert title="Unable to load finance dashboard" description={error} tone="danger" />
          <button type="button" className="button-secondary" onClick={() => void reload()}><RefreshCw className="h-4 w-4" />Retry</button>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Revenue" value={`KES ${data.data.totalRevenue.toLocaleString()}`} detail="Collected from paid payments." icon={Wallet} />
            <StatCard title="Outstanding Invoices" value={`KES ${data.data.outstandingInvoices.toLocaleString()}`} detail="Issued but unpaid invoice balance." icon={FileText} />
            <StatCard title="Overdue Invoices" value={`KES ${data.data.overdueInvoices.toLocaleString()}`} detail="Past due invoice amount." icon={FileText} accent="amber" />
            <StatCard title="Expenses This Month" value={`KES ${data.data.expensesThisMonth.toLocaleString()}`} detail="Monthly platform expenses." icon={Receipt} />
            <StatCard title="Profit Estimate" value={`KES ${data.data.profitEstimate.toLocaleString()}`} detail="Revenue minus expenses." icon={Wallet} accent="emerald" />
            <StatCard title="Quotation Conversion" value={`${data.data.quotationConversionRate.toLocaleString()}%`} detail="Converted quotation ratio." icon={FileText} />
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <section className="surface-card space-y-3">
              <SectionTitle title="Recent Payments" description="Latest captured transactions." />
              {data.data.recentPayments.length === 0 ? <EmptyState title="No recent payments" description="Payments will appear after collection records are created." /> : (
                <DataTable
                  rows={data.data.recentPayments}
                  rowKey={(row) => row.id}
                  minTableWidth="min-w-[780px] w-full"
                  columns={[
                    { key: 'date', header: 'Date', cell: (row) => formatDateOnly(row.paymentDate) },
                    { key: 'invoice', header: 'Invoice', cell: (row) => row.invoiceNumber || '-' },
                    { key: 'amount', header: 'Amount', cell: (row) => `KES ${row.amount.toLocaleString()}` },
                    { key: 'method', header: 'Method', cell: (row) => row.method },
                    { key: 'status', header: 'Status', cell: (row) => row.status },
                  ]}
                />
              )}
            </section>
            <section className="surface-card space-y-3">
              <SectionTitle title="Recent Invoices" description="Most recent billing records." />
              {data.data.recentInvoices.length === 0 ? <EmptyState title="No recent invoices" description="Invoices will appear here once created." /> : (
                <DataTable
                  rows={data.data.recentInvoices}
                  rowKey={(row) => row.id}
                  minTableWidth="min-w-[780px] w-full"
                  columns={[
                    { key: 'number', header: 'Invoice', cell: (row) => row.number },
                    { key: 'issueDate', header: 'Issue Date', cell: (row) => formatDateOnly(row.issueDate) },
                    { key: 'total', header: 'Total', cell: (row) => `KES ${row.total.toLocaleString()}` },
                    { key: 'paid', header: 'Paid', cell: (row) => `KES ${row.paidAmount.toLocaleString()}` },
                    { key: 'status', header: 'Status', cell: (row) => row.status },
                  ]}
                />
              )}
            </section>
          </section>
        </>
      ) : null}
    </div>
  )
}

export function FinanceQuotationsPage() {
  return <FinanceRecordPage mode="quotation" />
}

export function FinanceInvoicesPage() {
  return <FinanceRecordPage mode="invoice" />
}

export function FinancePaymentsPage() {
  return <FinanceRecordPage mode="payment" />
}

export function FinanceRevenuePage() {
  const { data, loading, error, reload } = useFinanceState()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const rows = useMemo(() => data.data.payments.filter((item) => {
    const date = item.paymentDate.slice(0, 10)
    return (!from || date >= from) && (!to || date <= to) && item.status === 'Paid'
  }), [data.data.payments, from, to])
  const total = rows.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="space-y-4">
      {loading ? <LoadingState label="Loading revenue" /> : null}
      {!loading && error ? (
        <section className="surface-card space-y-3">
          <InfoAlert title="Unable to load revenue" description={error} tone="danger" />
          <button type="button" className="button-secondary" onClick={() => void reload()}><RefreshCw className="h-4 w-4" />Retry</button>
        </section>
      ) : null}
      {!loading && !error ? (
        <section className="surface-card space-y-4">
          <SectionTitle title="Revenue Summary" description="Revenue derived from paid payments and invoices." />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="From Date"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="field-input" /></Field>
            <Field label="To Date"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="field-input" /></Field>
          </div>
          <StatCard title="Filtered Revenue" value={`KES ${total.toLocaleString()}`} detail="Total paid amount for current filters." icon={Wallet} />
          {rows.length === 0 ? <EmptyState title="No paid payments in range" description="Adjust date filters or record payments." /> : (
            <DataTable
              rows={rows}
              rowKey={(row) => row.id}
              minTableWidth="min-w-[980px] w-full"
              columns={[
                { key: 'date', header: 'Payment Date', cell: (row) => formatDateOnly(row.paymentDate) },
                { key: 'invoice', header: 'Invoice', cell: (row) => row.invoiceNumber || '-' },
                { key: 'method', header: 'Method', cell: (row) => row.method },
                { key: 'amount', header: 'Amount', cell: (row) => `KES ${row.amount.toLocaleString()}` },
              ]}
            />
          )}
        </section>
      ) : null}
    </div>
  )
}

export function FinanceExpensesPage() {
  return <FinanceRecordPage mode="expense" />
}

export function FinanceTaxSettingsPage() {
  const { data, loading, error, reload } = useFinanceState()
  const [name, setName] = useState(data.data.taxSetting.name)
  const [rate, setRate] = useState(data.data.taxSetting.defaultRate)
  const [mode, setMode] = useState(data.data.taxSetting.mode)
  const { pushToast } = useToast()

  useEffect(() => {
    setName(data.data.taxSetting.name)
    setRate(data.data.taxSetting.defaultRate)
    setMode(data.data.taxSetting.mode)
  }, [data.data.taxSetting.defaultRate, data.data.taxSetting.mode, data.data.taxSetting.name])

  async function saveTax() {
    try {
      await platformService.financeApi.saveTaxSetting(name, rate, mode)
      pushToast({ title: 'Tax settings saved', description: 'Tax settings were updated.', tone: 'success' })
      await reload()
    } catch (saveError) {
      pushToast({ title: 'Save failed', description: toServiceError(saveError, 'Unable to save tax settings.'), tone: 'danger' })
    }
  }

  return (
    <section className="surface-card space-y-4">
      <SectionTitle title="Tax Settings" description="Default tax name, rate, and mode used in quotations and invoices." />
      {loading ? <LoadingState label="Loading tax settings" /> : null}
      {!loading && error ? <InfoAlert title="Unable to load tax settings" description={error} tone="danger" /> : null}
      {!loading && !error ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Tax Name"><input value={name} onChange={(event) => setName(event.target.value)} className="field-input" /></Field>
            <Field label="Default Rate (%)"><input type="number" min={0} value={rate} onChange={(event) => setRate(Number(event.target.value) || 0)} className="field-input" /></Field>
            <Field label="Tax Mode">
              <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="field-input">
                <option value="Exclusive">Exclusive</option>
                <option value="Inclusive">Inclusive</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="button" className="button-primary" onClick={() => void saveTax()}>Save Tax Settings</button>
          </div>
        </>
      ) : null}
    </section>
  )
}

export function FinanceTemplatesPage() {
  const { data, loading, error, reload } = useFinanceState()
  const { pushToast } = useToast()

  async function setDefaultTemplate(type: 'Quotation' | 'Invoice' | 'Receipt', id: string) {
    try {
      const templates = data.data.templates.map((item) => (item.type === type ? { ...item, isDefault: item.id === id } : item))
      await platformService.financeApi.saveTemplates(templates)
      pushToast({ title: 'Template updated', description: 'Template defaults were saved.', tone: 'success' })
      await reload()
    } catch (saveError) {
      pushToast({ title: 'Save failed', description: toServiceError(saveError, 'Unable to save templates.'), tone: 'danger' })
    }
  }

  return (
    <section className="surface-card space-y-4">
      <SectionTitle title="Document Templates" description="Templates for quotation, invoice, and receipt documents." />
      {loading ? <LoadingState label="Loading templates" /> : null}
      {!loading && error ? <InfoAlert title="Unable to load templates" description={error} tone="danger" /> : null}
      {!loading && !error ? (
        <div className="grid gap-4 md:grid-cols-3">
          {data.data.templates.length === 0 ? <EmptyState title="No templates found" description="Create templates through finance template APIs." /> : data.data.templates.map((item) => (
            <article key={item.id} className="panel-subtle rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">{item.type}</p>
              <p className="mt-2 font-semibold text-app">{item.name}</p>
              <p className="mt-2 text-sm text-muted">{item.previewText}</p>
              <button type="button" className="button-secondary mt-4 w-full" onClick={() => void setDefaultTemplate(item.type, item.id)}>
                {item.isDefault ? 'Default Selected' : 'Set as Default'}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function FinanceRecordPage({ mode }: { mode: 'quotation' | 'invoice' | 'payment' | 'expense' }) {
  const { pushToast } = useToast()
  const { data, loading, error, reload } = useFinanceState()
  const [open, setOpen] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [status, setStatus] = useState<string>('Draft')
  const [method, setMethod] = useState<PaymentMethod>('M-Pesa')
  const [invoiceId, setInvoiceId] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseTax, setExpenseTax] = useState(0)
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10))
  const label = mode === 'quotation' ? 'Quotations' : mode === 'invoice' ? 'Invoices' : mode === 'payment' ? 'Payments' : 'Expenses'
  const amount = quantity * unitPrice

  async function save() {
    try {
      if (mode === 'quotation') {
        await platformService.financeApi.saveQuotation({ id: '', number: '', tenantName, issueDate: new Date(dateValue).toISOString(), dueDate: null, status: status as Quotation['status'], taxRate: data.data.taxSetting.defaultRate, taxMode: data.data.taxSetting.mode, lines: [{ id: '', description, quantity, unitPrice }], subtotal: amount, taxAmount: 0, total: amount })
      } else if (mode === 'invoice') {
        await platformService.financeApi.saveInvoice({ id: '', number: '', tenantName, issueDate: new Date(dateValue).toISOString(), dueDate: null, status: status as Invoice['status'], taxRate: data.data.taxSetting.defaultRate, taxMode: data.data.taxSetting.mode, lines: [{ id: '', description, quantity, unitPrice }], subtotal: amount, taxAmount: 0, total: amount, paidAmount: 0 })
      } else if (mode === 'payment') {
        await platformService.financeApi.savePayment({ id: '', invoiceId: invoiceId || undefined, amount, paymentDate: new Date(dateValue).toISOString(), method, status: status as PaymentStatus })
      } else {
        await platformService.financeApi.saveExpense({ id: '', expenseDate: new Date(dateValue).toISOString(), category: expenseCategory || 'General', vendor: tenantName || 'Vendor', description, amount, taxAmount: expenseTax, paymentMethod: method, status })
      }
      pushToast({ title: `${label.slice(0, -1)} saved`, description: 'Record saved successfully.', tone: 'success' })
      setOpen(false)
      await reload()
    } catch (saveError) {
      pushToast({ title: 'Save failed', description: toServiceError(saveError, 'Unable to save record.'), tone: 'danger' })
    }
  }

  return (
    <div className="space-y-4">
      {loading ? <LoadingState label={`Loading ${label.toLowerCase()}`} /> : null}
      {!loading && error ? <InfoAlert title={`Unable to load ${label.toLowerCase()}`} description={error} tone="danger" /> : null}
      {!loading && !error ? (
        <section className="surface-card space-y-4">
          <SectionTitle title={label} description={`Create and manage ${label.toLowerCase()}.`} action={<button type="button" className="button-primary" onClick={() => setOpen(true)}>Create {label.slice(0, -1)}</button>} />
          {mode === 'quotation' ? (
            <DataTable
              rows={data.data.quotations}
              rowKey={(row) => row.id}
              columns={[
                { key: 'number', header: 'Quotation', cell: (row) => row.number },
                { key: 'tenant', header: 'Tenant', cell: (row) => row.tenantName },
                { key: 'total', header: 'Total', cell: (row) => `KES ${row.total.toLocaleString()}` },
                { key: 'status', header: 'Status', cell: (row) => row.status },
                {
                  key: 'actions',
                  header: 'Actions',
                  className: 'min-w-[220px]',
                  cell: (row) => (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="button-secondary px-3 py-2"
                        onClick={async () => {
                          try {
                            await platformService.financeApi.sendQuotation(row.id)
                            pushToast({ title: 'Quotation sent', description: `${row.number} marked as sent.`, tone: 'success' })
                            await reload()
                          } catch (actionError) {
                            pushToast({ title: 'Action failed', description: toServiceError(actionError, 'Unable to send quotation.'), tone: 'danger' })
                          }
                        }}
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        className="button-secondary px-3 py-2"
                        onClick={async () => {
                          try {
                            await platformService.financeApi.convertQuotationToInvoice(row.id)
                            pushToast({ title: 'Converted', description: `${row.number} converted to invoice.`, tone: 'success' })
                            await reload()
                          } catch (actionError) {
                            pushToast({ title: 'Action failed', description: toServiceError(actionError, 'Unable to convert quotation.'), tone: 'danger' })
                          }
                        }}
                      >
                        Convert
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ) : null}

          {mode === 'invoice' ? (
            <DataTable
              rows={data.data.invoices}
              rowKey={(row) => row.id}
              columns={[
                { key: 'number', header: 'Invoice', cell: (row) => row.number },
                { key: 'tenant', header: 'Tenant', cell: (row) => row.tenantName },
                { key: 'total', header: 'Total', cell: (row) => `KES ${row.total.toLocaleString()}` },
                { key: 'status', header: 'Status', cell: (row) => row.status },
                {
                  key: 'actions',
                  header: 'Actions',
                  className: 'min-w-[260px]',
                  cell: (row) => (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="button-secondary px-3 py-2"
                        onClick={async () => {
                          try {
                            await platformService.financeApi.sendInvoice(row.id)
                            pushToast({ title: 'Invoice sent', description: `${row.number} marked as sent.`, tone: 'success' })
                            await reload()
                          } catch (actionError) {
                            pushToast({ title: 'Action failed', description: toServiceError(actionError, 'Unable to send invoice.'), tone: 'danger' })
                          }
                        }}
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        className="button-secondary px-3 py-2"
                        onClick={async () => {
                          try {
                            await platformService.financeApi.markInvoicePaid(row.id)
                            pushToast({ title: 'Invoice updated', description: `${row.number} marked as paid.`, tone: 'success' })
                            await reload()
                          } catch (actionError) {
                            pushToast({ title: 'Action failed', description: toServiceError(actionError, 'Unable to mark invoice paid.'), tone: 'danger' })
                          }
                        }}
                      >
                        Mark Paid
                      </button>
                      <button
                        type="button"
                        className="button-secondary px-3 py-2"
                        onClick={async () => {
                          try {
                            await platformService.financeApi.voidInvoice(row.id)
                            pushToast({ title: 'Invoice voided', description: `${row.number} was voided.`, tone: 'warning' })
                            await reload()
                          } catch (actionError) {
                            pushToast({ title: 'Action failed', description: toServiceError(actionError, 'Unable to void invoice.'), tone: 'danger' })
                          }
                        }}
                      >
                        Void
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ) : null}

          {mode === 'payment' ? (
            <DataTable
              rows={data.data.payments}
              rowKey={(row) => row.id}
              columns={[
                { key: 'date', header: 'Date', cell: (row) => formatDateOnly(row.paymentDate) },
                { key: 'invoice', header: 'Invoice', cell: (row) => row.invoiceNumber || '-' },
                { key: 'amount', header: 'Amount', cell: (row) => `KES ${row.amount.toLocaleString()}` },
                { key: 'status', header: 'Status', cell: (row) => row.status },
              ]}
            />
          ) : null}

          {mode === 'expense' ? (
            <DataTable
              rows={data.data.expenses}
              rowKey={(row) => row.id}
              columns={[
                { key: 'date', header: 'Date', cell: (row) => formatDateOnly(row.expenseDate) },
                { key: 'vendor', header: 'Vendor', cell: (row) => row.vendor },
                { key: 'amount', header: 'Amount', cell: (row) => `KES ${row.amount.toLocaleString()}` },
                { key: 'status', header: 'Status', cell: (row) => row.status || '-' },
                {
                  key: 'actions',
                  header: 'Actions',
                  cell: (row) => (
                    <button
                      type="button"
                      className="button-secondary px-3 py-2"
                      onClick={async () => {
                        try {
                          await platformService.financeApi.approveExpense(row.id)
                          pushToast({ title: 'Expense approved', description: 'Expense marked approved.', tone: 'success' })
                          await reload()
                        } catch (actionError) {
                          pushToast({ title: 'Action failed', description: toServiceError(actionError, 'Unable to approve expense.'), tone: 'danger' })
                        }
                      }}
                    >
                      Approve
                    </button>
                  ),
                },
              ]}
            />
          ) : null}
        </section>
      ) : null}

      <Modal open={open} title={`Create ${label.slice(0, -1)}`} description="Capture finance record details and save." onClose={() => setOpen(false)}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={mode === 'expense' ? 'Vendor/Payee' : 'Tenant Name'}><input value={tenantName} onChange={(event) => setTenantName(event.target.value)} className="field-input" /></Field>
          <Field label="Date"><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="field-input" /></Field>
          <Field label="Description"><input value={description} onChange={(event) => setDescription(event.target.value)} className="field-input" /></Field>
          <Field label="Quantity"><input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} className="field-input" /></Field>
          <Field label="Unit Price"><input type="number" min={0} value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value) || 0)} className="field-input" /></Field>
          <Field label="Amount"><input value={amount.toFixed(2)} readOnly className="field-input" /></Field>
          <Field label="Status"><input value={status} onChange={(event) => setStatus(event.target.value)} className="field-input" /></Field>
          <Field label="Payment Method"><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="field-input">{['Cash', 'M-Pesa', 'Bank Transfer', 'Cheque', 'Card', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          {mode === 'payment' ? <Field label="Linked Invoice"><select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className="field-input"><option value="">None</option>{data.data.invoices.map((item) => <option key={item.id} value={item.id}>{item.number}</option>)}</select></Field> : null}
          {mode === 'expense' ? <Field label="Expense Category"><input value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} className="field-input" /></Field> : null}
          {mode === 'expense' ? <Field label="Tax Amount"><input type="number" min={0} value={expenseTax} onChange={(event) => setExpenseTax(Number(event.target.value) || 0)} className="field-input" /></Field> : null}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="button-primary" onClick={() => void save()}>Save</button>
        </div>
      </Modal>
    </div>
  )
}

export function FinanceDashboardRedirectHint() {
  return (
    <div className="surface-card">
      <p className="text-sm text-muted">Use the Finance tabs to open Dashboard, Quotations, Invoices, Payments, Revenue, Expenses, Tax Settings, and Document Templates.</p>
      <Link className="button-primary mt-4 inline-flex" to="/platform/finance">Open Finance Dashboard</Link>
    </div>
  )
}
