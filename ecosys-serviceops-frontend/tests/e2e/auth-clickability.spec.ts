import { expect, test, type Locator, type Page } from '@playwright/test'

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function mockPlatformAuthSession(page: Page) {
  const meResponse = {
    user: {
      id: 'platform-owner-1',
      userId: 'platform-owner-1',
      fullName: 'Lena Atieno',
      email: 'superadmin@ecosys.local',
      role: 'superadmin',
      permissions: {
        canViewPlatformTenants: true,
      },
    },
    role: 'superadmin',
    permissions: {
      canViewPlatformTenants: true,
    },
    branches: [],
  }

  const tenants = [
    {
      tenantId: 'tenant-1',
      name: 'Acme Facilities',
      slug: 'acme-facilities',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acme.test',
      planName: 'Enterprise',
      licenseStatus: 'Active',
      userCount: 24,
      branchCount: 6,
      status: 'Active',
      createdAt: '2026-05-01T09:00:00.000Z',
    },
  ]

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill(json({ token: 'platform-token' }))
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill(json(meResponse))
  })

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill(json({ success: true }))
  })

  await page.route('**/api/platform/tenants', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill(json(tenants))
      return
    }

    await route.fulfill(json({ success: true }))
  })
}

async function loginAsPlatformOwner(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('superadmin@ecosys.local')
  await page.getByLabel('Password').fill('SuperAdmin123!')
  await page.getByRole('button', { name: /^login$/i }).click()
  await expect(page).toHaveURL(/\/(platform|command-centre)/)
  await expect(page.getByTestId('command-centre-sidebar')).toBeVisible()
}

async function openPlatformTenants(page: Page) {
  await page.goto('/platform/tenants')
  await expect(page).toHaveURL(/\/platform\/tenants/)
  await expect(page.getByTestId('tenants-page')).toBeVisible()
}

async function assertButtonIsClickable(page: Page, button: Locator) {
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()

  const box = await button.boundingBox()
  expect(box).not.toBeNull()

  const hitTarget = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y)
    if (!(element instanceof HTMLElement)) {
      return { topElement: 'none', blockedByOverlay: false }
    }

    const topElement = [
      element.tagName.toLowerCase(),
      element.id ? `#${element.id}` : '',
      typeof element.className === 'string' && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '',
    ].join('')

    return {
      topElement,
      blockedByOverlay: Boolean(element.closest('[data-ui-overlay="true"]')),
    }
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })

  expect(hitTarget.blockedByOverlay, `Button is blocked by overlay: ${hitTarget.topElement}`).toBeFalsy()
}

async function assertNoBlockingOverlays(page: Page) {
  await expect(page.locator('[data-ui-overlay="true"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveClass(/overflow-hidden|pointer-events-none/)

  const bodyState = await page.evaluate(() => ({
    overflow: document.body.style.overflow,
    pointerEvents: document.body.style.pointerEvents,
  }))

  expect(bodyState.overflow).toBe('')
  expect(bodyState.pointerEvents).toBe('')
}

async function logoutFromTopbar(page: Page) {
  await page.getByTestId('user-menu-trigger').click()
  await page.getByTestId('logout-button').click()
  await expect(page).toHaveURL(/\/login/)
}

test.describe('auth clickability regression', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformAuthSession(page)
  })

  test('platform UI stays clickable after logout and login again', async ({ page }) => {
    await loginAsPlatformOwner(page)
    await openPlatformTenants(page)

    const addTenantButton = page.getByRole('button', { name: /add tenant/i })
    await assertButtonIsClickable(page, addTenantButton)
    await addTenantButton.click()
    await expect(page.getByRole('heading', { name: /add tenant/i })).toBeVisible()
    await page.getByRole('button', { name: /close modal/i }).click()
    await assertNoBlockingOverlays(page)

    await logoutFromTopbar(page)
    await loginAsPlatformOwner(page)
    await openPlatformTenants(page)

    const addTenantButtonAgain = page.getByRole('button', { name: /add tenant/i })
    await assertNoBlockingOverlays(page)
    await assertButtonIsClickable(page, addTenantButtonAgain)
    await addTenantButtonAgain.click()
    await expect(page.getByRole('heading', { name: /add tenant/i })).toBeVisible()
    await page.getByRole('button', { name: /close modal/i }).click()
    await assertNoBlockingOverlays(page)
  })
})
