import { expect, test, type Page } from '@playwright/test'
import { CORS_HEADERS, json, loginWithMockSession, registerApiCatchAll } from './helpers/auth'

test.describe('work order execution vertical slice', () => {
  test('tenant user can run execution workflow, capture evidence, and request report download', async ({ page }) => {
    const state = createScenarioState()
    let pdfRequested = false

    await mockTenantSession(page, state, () => {
      pdfRequested = true
    })

    await page.goto(`/work-orders/${state.workOrder.id}`)
    await page.getByRole('button', { name: /execution \/ evidence \/ report/i }).click()
    await expect(page.getByTestId('work-order-execution-panel')).toBeVisible()

    await page.getByTestId('action-accept-job').click()
    await page.getByTestId('action-mark-in-transit').click()
    await page.getByTestId('action-mark-arrived').click()
    await page.getByTestId('action-start-work').click()

    await page.getByTestId('findings-input').fill('Burnt contactor found in the panel and cable lug was loose.')
    await page.getByTestId('work-done-input').fill('Replaced the contactor, retightened terminations, tested load transfer, and cleaned the cabinet.')
    await page.getByTestId('save-execution-notes').click()

    await page.getByTestId('material-select').selectOption('material-1')
    await page.getByTestId('add-material-usage').click()

    await page.getByTestId('photo-file-input').setInputFiles({
      name: 'before.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQDxAPEA8QDw8PDw8QEA8PDw8QFREWFhURFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGi0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAEAAQAMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQMC/8QAGhABAAMBAQEAAAAAAAAAAAAAAAECBAMREv/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A9wD5m0xvL0rjv//Z', 'base64'),
    })
    await page.getByTestId('photo-caption-input').fill('Before replacement: burnt contactor on phase B.')
    await page.getByTestId('upload-photo-button').click()

    await page.getByTestId('signature-type-select').selectOption('Technician')
    await page.getByTestId('signature-name-input').fill('Moses Otieno')
    await drawSignature(page, page.getByTestId('signature-pad'))
    await page.getByTestId('save-signature-button').click()

    await page.getByTestId('signature-type-select').selectOption('Client')
    await page.getByTestId('signature-name-input').fill('Alice Njeri')
    await drawSignature(page, page.getByTestId('signature-pad'))
    await page.getByTestId('save-signature-button').click()

    await page.getByTestId('action-complete-work').click()
    await expect(page.getByText(/the service report data has been finalized/i)).toBeVisible()

    await page.getByTestId('download-service-report').click()
    await expect.poll(() => pdfRequested).toBeTruthy()
    await expect(page.getByTestId('work-order-service-report')).toContainText('Before replacement: burnt contactor on phase B.')
  })
})

function createScenarioState() {
  const workOrder = {
    id: 'work-order-1',
    branchId: 'branch-1',
    branchName: 'Nairobi Service Hub',
    clientId: 'client-1',
    clientName: 'Acme Manufacturing',
    assetId: 'asset-1',
    assetName: 'Generator 02',
    assignmentGroupId: 'group-1',
    assignmentGroupName: 'Generator Team',
    workOrderNumber: 'WO-2026-0042',
    title: 'Generator transfer fault',
    description: 'Generator failed to transfer load after a mains outage.',
    priority: 'High',
    status: 'Open',
    slaStatus: 'On Track',
    assignmentType: 'AssignmentGroup',
    assignedTechnicianId: 'tech-1',
    assignedTechnicianName: 'Moses Otieno',
    assignedTechnicianIds: ['tech-1'],
    leadTechnicianId: 'tech-1',
    leadTechnicianName: 'Moses Otieno',
    dueDate: '2026-05-13T12:00:00.000Z',
    createdAt: '2026-05-13T08:00:00.000Z',
    workStartedAt: null,
    arrivalAt: null,
    departureAt: null,
    completedAt: null,
    workDoneNotes: '',
    jobCardNotes: '',
    slaResponseDeadline: '2026-05-13T09:00:00.000Z',
    slaResolutionDeadline: '2026-05-13T16:00:00.000Z',
    slaResponseBreached: false,
    slaResolutionBreached: false,
    slaResponseBreachedAt: null,
    slaResolutionBreachedAt: null,
    acknowledgedByName: null,
    acknowledgementComments: null,
    acknowledgementDate: null,
    isPreventiveMaintenance: false,
    assignmentStatus: 'AssignedToTechnician',
    assignmentNotes: 'Urgent site attendance requested.',
    technicianAssignments: [
      {
        id: 'assign-1',
        technicianId: 'tech-1',
        technicianName: 'Moses Otieno',
        isLead: true,
        status: 'Pending',
        assignedAt: '2026-05-13T08:05:00.000Z',
        acceptedAt: null,
        arrivalAt: null,
        departureAt: null,
        notes: 'Urgent site attendance requested.',
      },
    ],
    assignmentSummary: 'Generator Team -> Moses Otieno',
    isUnassigned: false,
    pmTemplateId: null,
    pmTemplateName: null,
    preventiveMaintenancePlanId: null,
    checklistItems: [],
  }

  return {
    workOrder,
    execution: {
      notes: {
        findings: '',
        workDone: '',
      },
      photos: [] as Array<Record<string, unknown>>,
      materialUsages: [] as Array<Record<string, unknown>>,
      signatures: [] as Array<Record<string, unknown>>,
      reportPreview: {
        companyName: 'Acme Manufacturing',
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        clientName: workOrder.clientName,
        siteLabel: workOrder.branchName,
        assetName: workOrder.assetName,
        assetDetails: 'GEN-02 | Generator | Plant 1',
        technicianTeam: workOrder.leadTechnicianName,
        reportedProblem: workOrder.description,
        findings: '',
        workDone: '',
        generatedAtLabel: '2026-05-13 10:30 UTC',
        timestamps: [
          { label: 'Created', value: '2026-05-13 08:00' },
          { label: 'Arrived', value: null },
          { label: 'Started', value: null },
          { label: 'Completed', value: null },
          { label: 'Departed', value: null },
        ],
        materials: [] as Array<Record<string, unknown>>,
        photoGroups: [] as Array<Record<string, unknown>>,
        signatures: [] as Array<Record<string, unknown>>,
        showPoweredByEcosys: true,
      },
    },
    materials: [
      {
        id: 'material-1',
        branchId: 'branch-1',
        branchName: 'Nairobi Service Hub',
        itemCode: 'CT-25A',
        itemName: '25A Contactor',
        category: 'Electrical',
        unitOfMeasure: 'pcs',
        quantityOnHand: 12,
        reorderLevel: 2,
        unitCost: 45,
        isActive: true,
        isLowStock: false,
        createdAt: '2026-05-10T09:00:00.000Z',
      },
    ],
  }
}

async function mockTenantSession(page: Page, state: ReturnType<typeof createScenarioState>, onPdfRequest: () => void) {
  const baseApi = 'http://localhost:5072'

  await registerApiCatchAll(page)
  await loginWithMockSession(page, {
    role: 'tenantAdmin',
    email: 'tech@tenant.test',
    fullName: 'Moses Otieno',
    tenantName: 'Acme Manufacturing',
    tenantId: 'tenant-1',
  })

  await page.route(`${baseApi}/api/workorders/work-order-1`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json(state.workOrder))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/execution`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json(state.execution))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/execution-notes`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    const body = route.request().postDataJSON() as { findings?: string; workDone?: string }
    state.execution.notes.findings = body.findings || ''
    state.execution.notes.workDone = body.workDone || ''
    state.execution.reportPreview.findings = state.execution.notes.findings
    state.execution.reportPreview.workDone = state.execution.notes.workDone
    state.workOrder.jobCardNotes = state.execution.notes.findings
    state.workOrder.workDoneNotes = state.execution.notes.workDone
    await route.fulfill(json(state.execution))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/technician-response`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    state.workOrder.technicianAssignments[0].status = 'Accepted'
    state.workOrder.technicianAssignments[0].acceptedAt = '2026-05-13T08:20:00.000Z'
    await route.fulfill(json(state.workOrder))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/in-transit`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    state.workOrder.technicianAssignments[0].status = 'InTransit'
    await route.fulfill(json(state.workOrder))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/arrival`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    state.workOrder.arrivalAt = '2026-05-13T08:40:00.000Z'
    state.workOrder.technicianAssignments[0].status = 'Arrived'
    state.execution.reportPreview.timestamps[1].value = '2026-05-13 08:40'
    await route.fulfill(json(state.workOrder))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/start`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    state.workOrder.status = 'In Progress'
    state.workOrder.workStartedAt = '2026-05-13T08:45:00.000Z'
    state.execution.reportPreview.timestamps[2].value = '2026-05-13 08:45'
    await route.fulfill(json(state.workOrder))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/materials-used`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    const body = route.request().postDataJSON() as { materialItemId: string; quantityUsed: number }
    const material = state.materials.find((item) => item.id === body.materialItemId)!
    state.execution.materialUsages.push({
      id: `usage-${state.execution.materialUsages.length + 1}`,
      materialItemId: material.id,
      materialName: material.itemName,
      unitOfMeasure: material.unitOfMeasure,
      assetId: state.workOrder.assetId,
      assetName: state.workOrder.assetName,
      quantityUsed: body.quantityUsed,
      unitCost: material.unitCost,
      chargeable: true,
      notes: null,
      usedByUserId: 'user-1',
      usedByName: 'Moses Otieno',
      usedAt: '2026-05-13T09:00:00.000Z',
    })
    state.execution.reportPreview.materials = [{
      name: material.itemName,
      quantityUsed: body.quantityUsed,
      unitOfMeasure: material.unitOfMeasure,
      unitCost: material.unitCost,
      chargeable: true,
      notes: null,
    }]
    await route.fulfill(json(state.execution))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/photos`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    if (route.request().method() === 'POST') {
      state.execution.photos.push({
        id: 'photo-1',
        attachmentId: 'attachment-1',
        fileName: 'before.jpg',
        publicUrl: 'https://example.test/before.jpg',
        caption: 'Before replacement: burnt contactor on phase B.',
        category: 'Before',
        includeInReport: true,
        uploadedByUserId: 'user-1',
        uploadedByName: 'Moses Otieno',
        uploadedAt: '2026-05-13T09:10:00.000Z',
      })
      state.execution.reportPreview.photoGroups = [{
        category: 'Before',
        photos: [{ caption: 'Before replacement: burnt contactor on phase B.', publicUrl: 'https://example.test/before.jpg' }],
      }]
    }
    await route.fulfill(json(state.execution))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/photos/*`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json(state.execution))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/signatures`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    const body = route.request().postDataJSON() as { signatureType: string; signerName: string; signerRole?: string; signatureDataUrl: string; comment?: string }
    const existingIndex = state.execution.signatures.findIndex((item) => item.signatureType === body.signatureType)
    const nextSignature = {
      id: `signature-${body.signatureType.toLowerCase()}`,
      signatureType: body.signatureType,
      signerName: body.signerName,
      signerRole: body.signerRole || null,
      signatureDataUrl: body.signatureDataUrl,
      comment: body.comment || null,
      capturedByUserId: 'user-1',
      capturedAt: '2026-05-13T09:15:00.000Z',
    }
    if (existingIndex >= 0) {
      state.execution.signatures[existingIndex] = nextSignature
    } else {
      state.execution.signatures.push(nextSignature)
    }
    state.execution.reportPreview.signatures = state.execution.signatures.map((sig) => ({
      signatureType: String(sig.signatureType),
      signerName: String(sig.signerName),
      signerRole: (sig.signerRole as string | null) || null,
      comment: (sig.comment as string | null) || null,
      capturedAtLabel: '2026-05-13 09:15',
    }))
    await route.fulfill(json(state.execution))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/complete`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    state.workOrder.status = 'Completed'
    state.workOrder.completedAt = '2026-05-13T09:20:00.000Z'
    state.execution.reportPreview.timestamps[3].value = '2026-05-13 09:20'
    await route.fulfill(json(state.workOrder))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/service-report`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json(state.execution.reportPreview))
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/service-report/pdf`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    onPdfRequest()
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'content-disposition': 'attachment; filename="WO-2026-0042-service-report.pdf"', ...CORS_HEADERS },
      body: '%PDF-1.4\n%Mock Service Report\n',
    })
  })

  await page.route(`${baseApi}/api/workorders/work-order-1/events`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json([]))
  })
  await page.route(`${baseApi}/api/workorders/work-order-1/assignment-history`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json([]))
  })
  await page.route(`${baseApi}/api/materials**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json(state.materials))
  })
  await page.route(`${baseApi}/api/technicians**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json([{
      id: 'tech-1',
      branchId: 'branch-1',
      branchName: 'Nairobi Service Hub',
      fullName: 'Moses Otieno',
      email: 'tech@tenant.test',
      phone: '0700000000',
      isTrackingActive: false,
      activeWorkOrderId: null,
      isActive: true,
      createdAt: '2026-05-01T08:00:00.000Z',
    }]))
  })
  await page.route(`${baseApi}/api/material-requests**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json([]))
  })
  await page.route(`${baseApi}/api/assignment-groups**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json([{
      id: 'group-1',
      name: 'Generator Team',
      description: 'Generator first response team',
      branchId: 'branch-1',
      branchName: 'Nairobi Service Hub',
      isActive: true,
      members: [{
        id: 'member-1',
        assignmentGroupId: 'group-1',
        technicianId: 'tech-1',
        memberName: 'Moses Otieno',
        email: 'tech@tenant.test',
        isLead: true,
        isActive: true,
        addedAt: '2026-05-01T09:00:00.000Z',
      }],
      technicianIds: ['tech-1'],
    }]))
  })
  await page.route(`${baseApi}/api/pm/templates**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS })
    await route.fulfill(json([]))
  })
}

async function drawSignature(page: Page, locator: ReturnType<Page['getByTestId']>) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Signature pad was not visible')
  }

  await page.mouse.move(box.x + 20, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 60)
  await page.mouse.move(box.x + 150, box.y + 30)
  await page.mouse.up()
}
