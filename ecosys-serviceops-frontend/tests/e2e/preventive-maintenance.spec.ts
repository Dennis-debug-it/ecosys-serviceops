import { expect, test, type Page, type Route } from '@playwright/test'
import { CORS_HEADERS, json, loginWithMockSession, registerApiCatchAll } from './helpers/auth'

const API = 'http://localhost:5072'

type TemplateRecord = {
  id: string
  name: string
  category: string
  description?: string | null
  checklist: Array<{
    id: string
    sectionName?: string | null
    question: string
    type: string
    required: boolean
    order: number
    options: string[]
  }>
  isActive: boolean
}

type PlanRecord = {
  id: string
  branchId?: string | null
  branchName?: string | null
  assetId: string
  assetName?: string | null
  clientId?: string | null
  clientName?: string | null
  pmTemplateId?: string | null
  pmTemplateName?: string | null
  frequency: string
  serviceIntervalMonths?: number | null
  autoSchedule: boolean
  lastPmDate?: string | null
  nextPmDate?: string | null
  status: string
  createdAt: string
}

type AssetRecord = {
  id: string
  clientId: string
  clientName: string
  siteId?: string | null
  siteName?: string | null
  assetCategoryId?: string | null
  assetCategoryName?: string | null
  assetName: string
  assetCode: string
  assetType?: string | null
  autoSchedulePm: boolean
  lastPmDate?: string | null
  nextPmDate?: string | null
  status: string
  createdAt: string
  customFieldValues: Array<Record<string, unknown>>
}

type WorkOrderRecord = {
  id: string
  branchId?: string | null
  branchName?: string | null
  clientId: string
  clientName?: string | null
  siteId?: string | null
  siteName?: string | null
  assetId?: string | null
  assetName?: string | null
  assignmentGroupId?: string | null
  assignmentGroupName?: string | null
  workOrderNumber: string
  title: string
  description?: string | null
  priority: string
  status: string
  slaStatus: string
  assignmentType?: string | null
  assignedTechnicianId?: string | null
  assignedTechnicianName?: string | null
  assignedTechnicianIds: string[]
  leadTechnicianId?: string | null
  leadTechnicianName?: string | null
  dueDate?: string | null
  createdAt: string
  workStartedAt?: string | null
  arrivalAt?: string | null
  departureAt?: string | null
  completedAt?: string | null
  workDoneNotes?: string | null
  jobCardNotes?: string | null
  slaResponseDeadline?: string | null
  slaResolutionDeadline?: string | null
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
  slaResponseBreachedAt?: string | null
  slaResolutionBreachedAt?: string | null
  acknowledgedByName?: string | null
  acknowledgementComments?: string | null
  acknowledgementDate?: string | null
  isPreventiveMaintenance: boolean
  assignmentStatus?: string | null
  assignmentNotes?: string | null
  technicianAssignments: Array<Record<string, unknown>>
  assignmentSummary?: string | null
  isUnassigned: boolean
  pmTemplateId?: string | null
  pmTemplateName?: string | null
  preventiveMaintenancePlanId?: string | null
  checklistItems: Array<{
    id: string
    pmTemplateQuestionId?: string | null
    sectionName?: string | null
    questionText: string
    inputType: string
    isRequired: boolean
    sortOrder: number
    responseValue?: string | null
    remarks?: string | null
    isCompleted: boolean
    completedByUserId?: string | null
    completedAt?: string | null
    options: string[]
  }>
}

function corsOptions(route: Route) {
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: CORS_HEADERS })
  }

  return null
}

async function mockPmModule(page: Page) {
  const templates: TemplateRecord[] = []
  const plans: PlanRecord[] = []
  const assets: AssetRecord[] = [
    {
      id: 'asset-pm-1',
      clientId: 'client-pm-1',
      clientName: 'Acme Facilities',
      siteId: 'site-pm-1',
      siteName: 'Nairobi HQ',
      assetCategoryId: 'cat-generator',
      assetCategoryName: 'Generator',
      assetName: 'Generator 01',
      assetCode: 'GEN-001',
      assetType: 'Generator',
      autoSchedulePm: true,
      lastPmDate: '2026-04-15T00:00:00.000Z',
      nextPmDate: '2026-05-15T00:00:00.000Z',
      status: 'Active',
      createdAt: '2026-05-01T08:00:00.000Z',
      customFieldValues: [],
    },
  ]

  let workOrder: WorkOrderRecord | null = null
  let events: Array<Record<string, unknown>> = []

  await registerApiCatchAll(page)
  await loginWithMockSession(page, {
    role: 'tenantAdmin',
    email: 'admin@acme.test',
    fullName: 'Alice Admin',
    tenantId: 'tenant-1',
    tenantName: 'Acme Facilities',
  })

  await page.route(`${API}/api/clients**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([{ id: 'client-pm-1', clientName: 'Acme Facilities' }]))
  })

  await page.route(`${API}/api/clients/*/sites**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([{ id: 'site-pm-1', siteName: 'Nairobi HQ' }]))
  })

  await page.route(`${API}/api/asset-categories`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([{ id: 'cat-generator', name: 'Generator', fields: [] }]))
  })

  await page.route(`${API}/api/assets**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json(assets))
  })

  await page.route(`${API}/api/pm/templates**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled

    if (route.request().method() === 'GET') {
      await route.fulfill(json(templates))
      return
    }

    const body = route.request().postDataJSON() as Record<string, unknown>
    const created: TemplateRecord = {
      id: `template-${templates.length + 1}`,
      name: String(body.name),
      category: String(body.category),
      description: String(body.description ?? '') || null,
      isActive: Boolean(body.isActive ?? true),
      checklist: ((body.checklist ?? []) as Array<Record<string, unknown>>).map((item, index) => ({
        id: `question-${index + 1}`,
        sectionName: String(item.sectionName ?? '') || null,
        question: String(item.question),
        type: String(item.type),
        required: Boolean(item.required),
        order: Number(item.order ?? index + 1),
        options: ((item.options ?? []) as string[]).map(String),
      })),
    }
    templates.push(created)
    await route.fulfill(json(created, 201))
  })

  await page.route(`${API}/api/preventive-maintenance`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled

    if (route.request().method() === 'GET') {
      await route.fulfill(json(plans))
      return
    }

    const body = route.request().postDataJSON() as Record<string, unknown>
    const asset = assets[0]
    const template = templates.find((item) => item.id === body.pmTemplateId)
    const created: PlanRecord = {
      id: 'plan-1',
      branchId: 'branch-1',
      branchName: 'Nairobi Service Hub',
      assetId: asset.id,
      assetName: asset.assetName,
      clientId: asset.clientId,
      clientName: asset.clientName,
      pmTemplateId: String(body.pmTemplateId),
      pmTemplateName: template?.name ?? null,
      frequency: String(body.frequency ?? 'Monthly'),
      serviceIntervalMonths: Number(body.serviceIntervalMonths ?? 1),
      autoSchedule: Boolean(body.autoSchedule),
      lastPmDate: String(body.lastPmDate || asset.lastPmDate),
      nextPmDate: String(body.nextPmDate || asset.nextPmDate),
      status: String(body.status ?? 'Active'),
      createdAt: '2026-05-16T09:00:00.000Z',
    }
    plans.splice(0, plans.length, created)
    await route.fulfill(json(created, 201))
  })

  await page.route(`${API}/api/preventive-maintenance/plan-1/generate-workorder`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled

    const plan = plans[0]
    const template = templates.find((item) => item.id === plan.pmTemplateId)
    workOrder = {
      id: 'wo-pm-1',
      branchId: 'branch-1',
      branchName: 'Nairobi Service Hub',
      clientId: 'client-pm-1',
      clientName: 'Acme Facilities',
      siteId: 'site-pm-1',
      siteName: 'Nairobi HQ',
      assetId: 'asset-pm-1',
      assetName: 'Generator 01',
      assignmentGroupId: null,
      assignmentGroupName: null,
      workOrderNumber: 'WO-PM-001',
      title: 'PM - Generator 01',
      description: 'Monthly PM for Generator 01.',
      priority: 'Medium',
      status: 'Open',
      slaStatus: 'On Track',
      assignmentType: 'Unassigned',
      assignedTechnicianIds: [],
      dueDate: plan.nextPmDate,
      createdAt: '2026-05-16T09:10:00.000Z',
      workStartedAt: null,
      arrivalAt: '2026-05-16T10:00:00.000Z',
      departureAt: null,
      completedAt: null,
      workDoneNotes: '',
      jobCardNotes: '',
      slaResponseBreached: false,
      slaResolutionBreached: false,
      isPreventiveMaintenance: true,
      assignmentStatus: 'Unassigned',
      assignmentNotes: null,
      technicianAssignments: [],
      assignmentSummary: 'Unassigned',
      isUnassigned: true,
      pmTemplateId: plan.pmTemplateId,
      pmTemplateName: plan.pmTemplateName,
      preventiveMaintenancePlanId: plan.id,
      checklistItems: (template?.checklist ?? []).map((item) => ({
        id: `wo-item-${item.id}`,
        pmTemplateQuestionId: item.id,
        sectionName: item.sectionName || 'General',
        questionText: item.question,
        inputType: item.type,
        isRequired: item.required,
        sortOrder: item.order,
        responseValue: null,
        remarks: null,
        isCompleted: false,
        completedByUserId: null,
        completedAt: null,
        options: item.options,
      })),
    }

    events = [
      {
        id: 'event-created',
        eventType: 'WorkOrderCreated',
        status: 'Open',
        message: 'PM work order generated from the maintenance plan.',
        occurredAt: '2026-05-16T09:10:00.000Z',
      },
    ]

    await route.fulfill(json(workOrder))
  })

  await page.route(`${API}/api/workorders/wo-pm-1`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json(workOrder))
  })

  await page.route(`${API}/api/workorders/wo-pm-1/execution`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json({
      notes: { findings: '', workDone: workOrder?.workDoneNotes ?? '' },
      photos: [],
      materialUsages: [],
      signatures: [
        {
          id: 'sig-tech',
          signatureType: 'Technician',
          signerName: 'Moses Otieno',
          signerRole: 'Technician',
          signatureDataUrl: 'data:image/png;base64,AAAA',
          capturedByUserId: 'user-1',
          capturedAt: '2026-05-16T10:05:00.000Z',
        },
        {
          id: 'sig-client',
          signatureType: 'Client',
          signerName: 'Alice Njeri',
          signerRole: 'Client',
          signatureDataUrl: 'data:image/png;base64,BBBB',
          capturedByUserId: 'user-1',
          capturedAt: '2026-05-16T10:06:00.000Z',
        },
      ],
      reportPreview: null,
    }))
  })

  await page.route(`${API}/api/workorders/wo-pm-1/events`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json(events))
  })

  await page.route(`${API}/api/workorders/wo-pm-1/assignment-history`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([]))
  })

  await page.route(`${API}/api/workorders/wo-pm-1/checklist/*`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    const itemId = route.request().url().split('/checklist/')[1]
    const body = route.request().postDataJSON() as { responseValue?: string | null; remarks?: string | null; isCompleted: boolean }
    const item = workOrder?.checklistItems.find((entry) => entry.id === itemId)
    if (item) {
      item.responseValue = body.responseValue ?? null
      item.remarks = body.remarks ?? null
      item.isCompleted = body.isCompleted
      item.completedByUserId = body.isCompleted ? 'tenant-admin-1' : null
      item.completedAt = body.isCompleted ? '2026-05-16T10:15:00.000Z' : null
      await route.fulfill(json(item))
      return
    }
    await route.fulfill(json({ message: 'Not found' }, 404))
  })

  await page.route(`${API}/api/workorders/wo-pm-1/complete`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    const body = route.request().postDataJSON() as { workDoneNotes?: string }
    if (workOrder) {
      workOrder.status = 'Completed'
      workOrder.completedAt = '2026-05-16T10:20:00.000Z'
      workOrder.workDoneNotes = body.workDoneNotes ?? ''
      assets[0].lastPmDate = workOrder.completedAt
      assets[0].nextPmDate = '2026-06-15T00:00:00.000Z'
      plans[0].lastPmDate = workOrder.completedAt
      plans[0].nextPmDate = assets[0].nextPmDate
      events = [
        ...events,
        {
          id: 'event-completed',
          eventType: 'StatusChanged',
          status: 'Completed',
          message: 'Work order completed.',
          occurredAt: workOrder.completedAt,
        },
      ]
    }
    await route.fulfill(json(workOrder))
  })

  await page.route(`${API}/api/materials**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([]))
  })

  await page.route(`${API}/api/technicians**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([]))
  })

  await page.route(`${API}/api/material-requests**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([]))
  })

  await page.route(`${API}/api/assignment-groups**`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([]))
  })

  await page.route(`${API}/api/attachments/entity/WorkOrder/wo-pm-1`, async (route) => {
    const handled = corsOptions(route)
    if (handled) return handled
    await route.fulfill(json([]))
  })
}

test.describe('preventive maintenance', () => {
  test.beforeEach(async ({ page }) => {
    await mockPmModule(page)
  })

  test('create PM template, create plan, generate PM work order, complete checklist, and update asset PM dates', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.getByRole('heading', { name: /preventive maintenance templates/i })).toBeVisible()

    await page.getByRole('button', { name: /new template/i }).click()
    await page.getByLabel('Template name').fill('Generator Monthly PM')
    await page.getByLabel('Category').selectOption('Generator')
    await page.getByLabel('Description').fill('Monthly service checklist for generator assets.')
    await page.getByLabel('Section').fill('Readings')
    await page.getByLabel('Question 1').fill('Runtime Hours')
    await page.getByLabel('Answer type').selectOption('number')
    await page.locator('button.button-primary', { hasText: 'Create template' }).click()

    await expect(page.getByText('Generator Monthly PM')).toBeVisible()

    await page.goto('/preventive-maintenance')
    await expect(page.getByRole('heading', { name: /preventive maintenance plans/i })).toBeVisible()

    await page.getByRole('button', { name: /add plan/i }).click()
    await page.getByLabel('Asset').selectOption('asset-pm-1')
    await page.getByLabel('PM Template').selectOption('template-1')
    await page.getByLabel('Service Interval').selectOption('1')
    await page.getByLabel('Last PM date').fill('2026-04-15')
    await page.getByLabel('Next PM date').fill('2026-05-15')
    await page.getByRole('button', { name: /save plan/i }).click()

    await expect(page.getByRole('table').getByText('Generator 01')).toBeVisible()
    await expect(page.getByRole('table').getByText('Generator Monthly PM')).toBeVisible()

    await page.getByRole('button', { name: /generate work order/i }).click()
    await expect(page.getByText(/work order generated/i)).toBeVisible()

    await page.goto('/work-orders/wo-pm-1')
    await expect(page.getByText('WO-PM-001', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /^pm checklist$/i }).click()
    await expect(page.getByText('Runtime Hours')).toBeVisible()
    await page.getByRole('spinbutton').fill('123.5')
    await page.getByLabel('Completed').check()
    await page.getByRole('button', { name: /save item/i }).click()
    await expect(page.getByText(/checklist updated/i)).toBeVisible()
    await expect(page.getByLabel('Completed')).toBeChecked()

    await page.getByRole('button', { name: /^overview$/i }).click()
    await page.getByPlaceholder(/describe the work done/i).fill('Completed PM checklist, cleaned generator, and recorded runtime hours.')
    await page.getByRole('button', { name: /complete work order/i }).click()
    await expect(page.getByText(/work order completed/i)).toBeVisible()

    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: /asset register/i })).toBeVisible()
    await expect(page.getByRole('table').getByText('15 Jun 2026')).toBeVisible()
  })
})
