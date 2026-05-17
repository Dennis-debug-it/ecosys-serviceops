import { expect, test, type Page } from '@playwright/test'
import { CORS_HEADERS, json, loginWithMockSession, registerApiCatchAll } from './helpers/auth'

const API = 'http://localhost:5072'

const TENANT_SESSION = {
  user: {
    userId: 'user-a1',
    fullName: 'Alice Admin',
    email: 'admin@attach.test',
  },
  tenant: {
    tenantId: 'tenant-a1',
    companyName: 'Attach Corp',
  },
}

const WORK_ORDER = {
  id: 'wo-att-1',
  branchId: 'branch-a1',
  branchName: 'Attach Hub',
  clientId: 'client-a1',
  clientName: 'Attach Corp',
  assetId: 'asset-a1',
  assetName: 'Generator 01',
  assignmentGroupId: null,
  assignmentGroupName: null,
  workOrderNumber: 'WO-ATT-001',
  title: 'Attachment test order',
  description: 'Testing file attachments.',
  priority: 'Low',
  status: 'Open',
  slaStatus: 'On Track',
  assignmentType: null,
  assignedTechnicianId: null,
  assignedTechnicianName: null,
  assignedTechnicianIds: [],
  leadTechnicianId: null,
  leadTechnicianName: null,
  dueDate: '2026-06-01T12:00:00.000Z',
  createdAt: '2026-05-14T08:00:00.000Z',
  workStartedAt: null,
  arrivalAt: null,
  departureAt: null,
  completedAt: null,
  workDoneNotes: '',
  jobCardNotes: '',
  slaResponseDeadline: null,
  slaResolutionDeadline: null,
  slaResponseBreached: false,
  slaResolutionBreached: false,
  slaResponseBreachedAt: null,
  slaResolutionBreachedAt: null,
  acknowledgedByName: null,
  acknowledgementComments: null,
  acknowledgementDate: null,
  isPreventiveMaintenance: false,
  assignmentStatus: null,
  assignmentNotes: null,
  technicianAssignments: [],
  assignmentSummary: null,
  isUnassigned: true,
  pmTemplateId: null,
  pmTemplateName: null,
  preventiveMaintenancePlanId: null,
  checklistItems: [],
}

const EXISTING_ATTACHMENT = {
  id: 'att-001',
  entityType: 'WorkOrder',
  entityId: 'wo-att-1',
  fileName: 'site-report.pdf',
  fileSize: 204800,
  mimeType: 'application/pdf',
  publicUrl: `${API}/storage/att-001/site-report.pdf`,
  uploadedByUserId: 'user-a1',
  createdAt: '2026-05-14T09:00:00.000Z',
}

const UPLOADED_ATTACHMENT = {
  id: 'att-002',
  entityType: 'WorkOrder',
  entityId: 'wo-att-1',
  fileName: 'photo-before.jpg',
  fileSize: 102400,
  mimeType: 'image/jpeg',
  publicUrl: `${API}/storage/att-002/photo-before.jpg`,
  uploadedByUserId: 'user-a1',
  createdAt: '2026-05-14T09:05:00.000Z',
}

async function mockApi(page: Page, attachments: unknown[]) {
  await registerApiCatchAll(page)
  await loginWithMockSession(page, {
    role: 'tenantAdmin',
    email: TENANT_SESSION.user.email,
    fullName: TENANT_SESSION.user.fullName,
    tenantId: TENANT_SESSION.tenant.tenantId,
    tenantName: TENANT_SESSION.tenant.companyName,
  })

  await page.route(`${API}/api/workorders/${WORK_ORDER.id}`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json(WORK_ORDER))
  })
  await page.route(`${API}/api/workorders/${WORK_ORDER.id}/execution`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json({ notes: { findings: '', workDone: '' }, photos: [], materialUsages: [], signatures: [], reportPreview: null }))
  })
  await page.route(`${API}/api/workorders/${WORK_ORDER.id}/events`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/workorders/${WORK_ORDER.id}/assignment-history`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/materials**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/technicians**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/material-requests**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/assignment-groups**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/pm/templates**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json([]))
  })
  await page.route(`${API}/api/attachments/entity/WorkOrder/${WORK_ORDER.id}`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    return route.fulfill(json(attachments))
  })
}

async function navigateToWorkOrder(page: Page) {
  await page.goto(`/work-orders/${WORK_ORDER.id}`)
}

test.describe('Attachment management', () => {
  test.setTimeout(45_000)

  test('documents tab shows existing attachment in list', async ({ page }) => {
    await mockApi(page, [EXISTING_ATTACHMENT])
    await navigateToWorkOrder(page)

    await page.getByRole('button', { name: /^documents$/i }).click()

    await expect(page.getByTestId('attachment-panel')).toBeVisible()
    await expect(page.getByTestId('attachment-list')).toBeVisible()
    await expect(page.getByText('site-report.pdf')).toBeVisible()
  })

  test('documents tab shows empty state when no attachments', async ({ page }) => {
    await mockApi(page, [])
    await navigateToWorkOrder(page)

    await page.getByRole('button', { name: /^documents$/i }).click()

    await expect(page.getByTestId('attachment-panel')).toBeVisible()
    await expect(page.getByTestId('attachment-empty')).toBeVisible()
  })

  test('upload adds attachment to the list', async ({ page }) => {
    let attachmentsList: unknown[] = []

    await mockApi(page, attachmentsList)

    await page.route(`${API}/api/attachments/upload`, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
      attachmentsList = [UPLOADED_ATTACHMENT]
      return route.fulfill(json(UPLOADED_ATTACHMENT))
    })

    await navigateToWorkOrder(page)
    await page.getByRole('button', { name: /^documents$/i }).click()

    await expect(page.getByTestId('attachment-panel')).toBeVisible()
    await expect(page.getByTestId('attachment-upload-btn')).toBeVisible()

    await page.getByTestId('attachment-file-input').setInputFiles({
      name: 'photo-before.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    })

    await expect(page.getByText('photo-before.jpg')).toBeVisible({ timeout: 8000 })
  })

  test('delete removes attachment from the list', async ({ page }) => {
    let deleted = false

    await mockApi(page, [EXISTING_ATTACHMENT])

    await page.route(`${API}/api/attachments/${EXISTING_ATTACHMENT.id}`, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
      if (route.request().method() === 'DELETE') {
        deleted = true
        return route.fulfill({ status: 204, headers: CORS_HEADERS })
      }

      return route.fulfill(json(EXISTING_ATTACHMENT))
    })

    await navigateToWorkOrder(page)
    await page.getByRole('button', { name: /^documents$/i }).click()

    await expect(page.getByTestId('attachment-list')).toBeVisible()
    await expect(page.getByText('site-report.pdf')).toBeVisible()

    await page.getByTestId(`attachment-delete-${EXISTING_ATTACHMENT.id}`).click()

    await expect(page.getByText('site-report.pdf')).not.toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('attachment-empty')).toBeVisible()
    expect(deleted).toBe(true)
  })
})
