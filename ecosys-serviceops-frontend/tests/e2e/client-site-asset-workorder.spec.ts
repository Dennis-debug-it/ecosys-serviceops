import { expect, test, type Page } from '@playwright/test'
import { E2E_API_URL } from './helpers/test-data'
import { loginAsTenantAdmin } from './helpers/auth'

// Helper: authenticate and return auth token from localStorage
async function getAuthToken(page: Page): Promise<string> {
  const raw = await page.evaluate(() => window.localStorage.getItem('ecosys.serviceops.auth'))
  if (!raw) throw new Error('No auth token in localStorage.')
  const parsed = JSON.parse(raw) as { token?: string }
  if (!parsed.token) throw new Error('Auth token missing in stored value.')
  return parsed.token
}

// Helper: call API with tenant auth
async function apiPost<T>(page: Page, path: string, body: unknown): Promise<T> {
  const token = await getAuthToken(page)
  return page.evaluate(
    async ({ apiUrl, path, body, token }) => {
      const res = await fetch(`${apiUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`POST ${path} failed (${res.status}): ${text}`)
      }
      return res.json() as T
    },
    { apiUrl: E2E_API_URL, path, body, token },
  )
}

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const token = await getAuthToken(page)
  return page.evaluate(
    async ({ apiUrl, path, token }) => {
      const res = await fetch(`${apiUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`)
      return res.json() as T
    },
    { apiUrl: E2E_API_URL, path, token },
  )
}

// The DataTable renders a mobile card (md:hidden) AND a desktop table (md:block).
// On desktop viewport, the mobile card is CSS-hidden. Use the table section to find text.
function inTable(page: Page, text: string) {
  return page.locator('table').getByText(text)
}

test.describe('Client → Site → Asset → Work Order flow', () => {
  test.setTimeout(90_000)

  let clientId: string
  let siteId: string
  let assetId: string

  test.beforeEach(async ({ page }) => {
    await loginAsTenantAdmin(page)
  })

  test('create client', async ({ page }) => {
    const ts = Date.now()
    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E Client ${ts}`,
      clientType: 'Enterprise',
      email: `e2e.client.${ts}@example.com`,
      phone: '+254700000001',
      contactPerson: 'E2E Contact',
      contactPhone: '+254700000002',
    })
    expect(client.id).toBeTruthy()
    clientId = client.id

    await page.goto('/clients')
    await expect(inTable(page, `E2E Client ${ts}`)).toBeVisible({ timeout: 15000 })
  })

  test('create site under client', async ({ page }) => {
    const ts = Date.now()
    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E ClientForSite ${ts}`,
      clientType: 'Enterprise',
      email: `e2e.clientsite.${ts}@example.com`,
      contactPerson: 'E2E Admin',
      contactPhone: '+254700000003',
    })
    clientId = client.id

    const site = await apiPost<{ id: string }>(page, `/api/clients/${clientId}/sites`, {
      siteName: `E2E Site ${ts}`,
      siteType: 'Branch',
      streetAddress: '1 Test Street',
      townCity: 'Nairobi',
      county: 'Nairobi',
      country: 'Kenya',
      region: 'Nairobi',
      contactPerson: 'Site Contact',
      contactPhone: '+254700000004',
      accessNotes: `Access via main gate — ${ts}`,
    })
    expect(site.id).toBeTruthy()
    siteId = site.id

    await page.goto('/clients')
    await expect(inTable(page, `E2E ClientForSite ${ts}`)).toBeVisible({ timeout: 15000 })

    const sitesBtn = page.getByRole('button', { name: /sites/i }).first()
    await sitesBtn.click()
    await expect(page.getByText(`E2E Site ${ts}`).first()).toBeVisible({ timeout: 10000 })
  })

  test('edit site details', async ({ page }) => {
    const ts = Date.now()
    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E ClientEdit ${ts}`,
      clientType: 'SME',
      email: `e2e.edit.${ts}@example.com`,
      contactPerson: 'Edit Admin',
      contactPhone: '+254700000005',
    })

    const site = await apiPost<{ id: string }>(page, `/api/clients/${client.id}/sites`, {
      siteName: `Site Before Edit ${ts}`,
      siteType: 'HQ',
      townCity: 'Mombasa',
      region: 'Coast',
    })

    await page.goto('/clients')
    await expect(inTable(page, `E2E ClientEdit ${ts}`)).toBeVisible({ timeout: 15000 })

    // Open sites drawer via the Sites button on the client's row
    const sitesBtn = page.getByRole('button', { name: /sites/i }).first()
    await sitesBtn.click()
    const sitesDrawer = page.locator('[data-ui-overlay="true"]')
    await expect(sitesDrawer.getByText(`Site Before Edit ${ts}`).first()).toBeVisible({ timeout: 10000 })

    // Click Edit on the site — scope to the drawer to avoid hitting client Edit buttons behind it
    await sitesDrawer.getByRole('button', { name: /^edit$/i }).first().click()

    // Update site name
    const siteNameInput = sitesDrawer.getByLabel(/site name/i)
    await siteNameInput.fill(`Site After Edit ${ts}`)
    await sitesDrawer.getByRole('button', { name: /save site/i }).click()

    await expect(sitesDrawer.getByText(`Site After Edit ${ts}`).first()).toBeVisible({ timeout: 10000 })
    void site
  })

  test('create asset linked to site', async ({ page }) => {
    const ts = Date.now()
    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E ClientAsset ${ts}`,
      clientType: 'Corporate',
      email: `e2e.asset.${ts}@example.com`,
      contactPerson: 'Asset Admin',
      contactPhone: '+254700000006',
    })
    clientId = client.id

    const site = await apiPost<{ id: string }>(page, `/api/clients/${clientId}/sites`, {
      siteName: `E2E Asset Site ${ts}`,
      siteType: 'Warehouse',
      townCity: 'Kisumu',
      region: 'Nyanza',
    })
    siteId = site.id

    const asset = await apiPost<{ id: string; siteId?: string; siteName?: string }>(page, '/api/assets', {
      clientId,
      siteId,
      assetName: `E2E Generator ${ts}`,
      assetCode: '',
      assetType: 'Generator',
      location: 'Room 1A',
      autoSchedulePm: false,
      status: 'Active',
    })
    expect(asset.id).toBeTruthy()
    expect(asset.siteId).toBe(siteId)
    assetId = asset.id

    await page.goto('/assets')
    await expect(inTable(page, `E2E Generator ${ts}`)).toBeVisible({ timeout: 15000 })
  })

  test('asset dropdown filters by selected site in work order creation', async ({ page }) => {
    const ts = Date.now()

    // Create client
    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E WO Client ${ts}`,
      clientType: 'Corporate',
      email: `e2e.wo.${ts}@example.com`,
      contactPerson: 'WO Admin',
      contactPhone: '+254700000007',
    })
    clientId = client.id

    // Create two sites
    const site1 = await apiPost<{ id: string }>(page, `/api/clients/${clientId}/sites`, {
      siteName: `E2E Site Alpha ${ts}`,
      siteType: 'Branch',
      townCity: 'Nairobi',
      region: 'Nairobi',
      accessNotes: `Alpha access notes ${ts}`,
    })
    const site2 = await apiPost<{ id: string }>(page, `/api/clients/${clientId}/sites`, {
      siteName: `E2E Site Beta ${ts}`,
      siteType: 'Warehouse',
      townCity: 'Mombasa',
      region: 'Coast',
    })

    // Create asset at site1
    const asset1 = await apiPost<{ id: string }>(page, '/api/assets', {
      clientId,
      siteId: site1.id,
      assetName: `E2E Asset Alpha ${ts}`,
      assetCode: '',
      assetType: 'UPS',
      autoSchedulePm: false,
      status: 'Active',
    })

    // Create asset at site2
    const asset2 = await apiPost<{ id: string }>(page, '/api/assets', {
      clientId,
      siteId: site2.id,
      assetName: `E2E Asset Beta ${ts}`,
      assetCode: '',
      assetType: 'Generator',
      autoSchedulePm: false,
      status: 'Active',
    })

    await page.goto('/work-orders')
    await expect(page.getByRole('button', { name: /new work order/i })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /new work order/i }).click()

    // Select client — site select and asset select are populated
    const clientSelect = page.locator('select:not([disabled])').filter({ hasText: /select a client/i })
    await clientSelect.selectOption({ value: clientId })

    // Select site1 — only asset1 should appear in the asset select
    const siteSelect = page.locator('select').filter({ hasText: /no site selected|select a client first/i })
    await siteSelect.selectOption({ value: site1.id })
    const assetSelect = page.locator('select').filter({ hasText: /no linked asset/i })
    await expect(assetSelect).toContainText(`E2E Asset Alpha ${ts}`, { timeout: 8000 })
    await expect(assetSelect).not.toContainText(`E2E Asset Beta ${ts}`)

    // Switch to site2 — only asset2 should appear
    await siteSelect.selectOption({ value: site2.id })
    await expect(assetSelect).toContainText(`E2E Asset Beta ${ts}`, { timeout: 8000 })
    await expect(assetSelect).not.toContainText(`E2E Asset Alpha ${ts}`)

    void asset1; void asset2
  })

  test('create work order with client, site, and asset', async ({ page }) => {
    const ts = Date.now()

    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E WO Full ${ts}`,
      clientType: 'Enterprise',
      email: `e2e.wofull.${ts}@example.com`,
      contactPerson: 'Full Admin',
      contactPhone: '+254700000008',
    })
    clientId = client.id

    const site = await apiPost<{ id: string }>(page, `/api/clients/${clientId}/sites`, {
      siteName: `E2E Full Site ${ts}`,
      siteType: 'HQ',
      townCity: 'Nairobi',
      region: 'Nairobi',
      accessNotes: `Gate code: ${ts}`,
    })
    siteId = site.id

    const asset = await apiPost<{ id: string }>(page, '/api/assets', {
      clientId,
      siteId,
      assetName: `E2E Full Asset ${ts}`,
      assetCode: '',
      assetType: 'HVAC',
      autoSchedulePm: false,
      status: 'Active',
    })
    assetId = asset.id

    await page.goto('/work-orders')
    await expect(page.getByRole('button', { name: /new work order/i })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /new work order/i }).click()

    const clientSelect = page.locator('select:not([disabled])').filter({ hasText: /select a client/i })
    await clientSelect.selectOption({ value: clientId })
    const siteSelect = page.locator('select').filter({ hasText: /no site selected|select a client first/i })
    await siteSelect.selectOption({ value: siteId })
    const assetSelect = page.locator('select').filter({ hasText: /no linked asset/i })
    await assetSelect.selectOption({ value: assetId })
    await page.getByLabel(/title/i).fill(`E2E Work Order ${ts}`)
    await page.getByRole('button', { name: /^create$/i }).click()

    // Work order should appear in the list
    await expect(inTable(page, `E2E Work Order ${ts}`)).toBeVisible({ timeout: 15000 })
  })

  test('work order detail shows client, site, and asset', async ({ page }) => {
    const ts = Date.now()

    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E Detail Client ${ts}`,
      clientType: 'SME',
      email: `e2e.detail.${ts}@example.com`,
      contactPerson: 'Detail Admin',
      contactPhone: '+254700000009',
    })
    clientId = client.id

    const site = await apiPost<{ id: string }>(page, `/api/clients/${clientId}/sites`, {
      siteName: `E2E Detail Site ${ts}`,
      siteType: 'Data Centre',
      townCity: 'Nairobi',
      region: 'Nairobi',
      accessNotes: `Server room badge required ${ts}`,
    })
    siteId = site.id

    const asset = await apiPost<{ id: string }>(page, '/api/assets', {
      clientId,
      siteId,
      assetName: `E2E Detail Asset ${ts}`,
      assetCode: '',
      assetType: 'Server',
      autoSchedulePm: false,
      status: 'Active',
    })
    assetId = asset.id

    // Create via API for speed
    const wo = await apiPost<{ id: string; workOrderNumber: string }>(page, '/api/workorders', {
      clientId,
      siteId,
      assetId,
      title: `E2E Detail WO ${ts}`,
      priority: 'High',
      isPreventiveMaintenance: false,
    })
    expect(wo.id).toBeTruthy()

    await page.goto(`/work-orders/${wo.id}`)
    // Work order detail page shows client, site, asset in the "Client & asset" block
    await expect(page.getByText(`E2E Detail Client ${ts}`).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(`E2E Detail Site ${ts}`).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(`E2E Detail Asset ${ts}`).first()).toBeVisible({ timeout: 10000 })
  })

  test('site access notes appear in work order job card notes', async ({ page }) => {
    const ts = Date.now()
    const accessNotes = `Access via gate B, badge required — ref ${ts}`

    const client = await apiPost<{ id: string }>(page, '/api/clients', {
      clientName: `E2E Access Client ${ts}`,
      clientType: 'Corporate',
      email: `e2e.access.${ts}@example.com`,
      contactPerson: 'Access Admin',
      contactPhone: '+254700000010',
    })

    const site = await apiPost<{ id: string }>(page, `/api/clients/${client.id}/sites`, {
      siteName: `E2E Access Site ${ts}`,
      siteType: 'Branch',
      accessNotes,
    })

    const wo = await apiPost<{ id: string; jobCardNotes?: string }>(page, '/api/workorders', {
      clientId: client.id,
      siteId: site.id,
      title: `E2E Access WO ${ts}`,
      priority: 'Medium',
      isPreventiveMaintenance: false,
    })

    expect(wo.jobCardNotes).toBe(accessNotes)

    // Verify via GET
    const fetched = await apiGet<{ jobCardNotes?: string }>(page, `/api/workorders/${wo.id}`)
    expect(fetched.jobCardNotes).toBe(accessNotes)
  })

  test('sites page loads and shows filter controls', async ({ page }) => {
    await page.goto('/sites')
    await expect(page.getByRole('heading', { name: /sites register/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByPlaceholder(/search by site/i)).toBeVisible()
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })
})
