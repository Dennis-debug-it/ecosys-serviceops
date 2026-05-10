import { expect, test, type Page } from '@playwright/test'

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function mockSuperAdminLogin(page: Page) {
  const permissions = {
    canViewPlatformTenants: true,
    canCreatePlatformTenants: true,
    canEditPlatformTenants: true,
    canUpdatePlatformTenantStatus: true,
    canDeactivatePlatformTenants: true,
  }

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill(json({
      token: 'platform-token',
      user: { role: 'SuperAdmin', permissions },
      tenant: { companyName: 'Ecosys Platform' },
    }))
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill(json({
      user: {
        userId: 'platform-owner-1',
        fullName: 'Platform Owner',
        email: 'superadmin@ecosys.local',
        role: 'SuperAdmin',
        permissions,
      },
      tenant: {
        tenantId: 'platform-root',
        companyName: 'Ecosys Platform',
      },
      branches: [],
    }))
  })

  await page.route('**/api/platform/**', async (route) => {
    await route.fulfill(json([]))
  })
}

async function mockTenantLogin(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill(json({
      token: 'tenant-token',
      user: { role: 'Admin' },
      tenant: { companyName: 'Acme Facilities' },
    }))
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill(json({
      user: {
        userId: 'tenant-admin-1',
        fullName: 'Tenant Admin',
        email: 'admin@acme.test',
        role: 'Admin',
        hasAllBranchAccess: true,
        permissions: {
          canViewWorkOrders: true,
          canCreateWorkOrders: true,
          canAssignWorkOrders: true,
          canCompleteWorkOrders: true,
          canApproveMaterials: true,
          canIssueMaterials: true,
          canManageAssets: true,
          canManageSettings: true,
          canViewReports: true,
        },
      },
      tenant: {
        tenantId: 'tenant-1',
        companyName: 'Acme Facilities',
        country: 'Kenya',
      },
      branches: [],
    }))
  })

  await page.route('**/api/dashboard/summary**', async (route) => {
    await route.fulfill(json({
      openWorkOrders: 0,
      closedWorkOrders: 0,
      overdueWorkOrders: 0,
      assets: 0,
      clients: 0,
      materialsLowStock: 0,
      unassignedWorkOrders: 0,
      assignedToGroup: 0,
      assignedToTechnicians: 0,
      awaitingAcceptance: 0,
      techniciansOnSite: 0,
      workOrdersByGroup: [],
      technicianWorkload: [],
    }))
  })

  await page.route('**/api/work-orders**', async (route) => {
    await route.fulfill(json([]))
  })

  await page.route('**/api/materials**', async (route) => {
    await route.fulfill(json([]))
  })
}

test.describe('auth password flows', () => {
  test('wrong password shows clear feedback and keeps the page usable', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill(json({ message: 'Invalid email or password.' }, 401))
    })

    await page.goto('/login')
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()

    await page.getByLabel('Email').fill('wrong@ecosys.test')
    await page.getByLabel('Password').fill('incorrect')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page.getByRole('alert')).toContainText('Invalid email or password. Please check your credentials and try again.')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: /^login$/i })).toBeEnabled()
  })

  test('successful SuperAdmin login routes to /platform', async ({ page }) => {
    await mockSuperAdminLogin(page)

    await page.goto('/login')
    await page.getByLabel('Email').fill('superadmin@ecosys.local')
    await page.getByLabel('Password').fill('SuperAdmin123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page).toHaveURL(/\/platform/)
  })

  test('successful tenant login routes to /dashboard', async ({ page }) => {
    await mockTenantLogin(page)

    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@acme.test')
    await page.getByLabel('Password').fill('TenantAdmin123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(/Operational overview/i)).toBeVisible()
  })

  test('forgot password page submits and shows generic success', async ({ page }) => {
    let requestCount = 0
    await page.route('**/api/auth/forgot-password', async (route) => {
      requestCount += 1
      await route.fulfill(json({
        message: 'If an account exists for this email, password reset instructions will be sent shortly.',
      }))
    })

    await page.goto('/forgot-password')
    await page.getByLabel('Email address').fill('person@example.com')
    await page.getByRole('button', { name: /send reset link/i }).click()

    await expect(page.getByRole('status')).toContainText('If an account exists for this email, password reset instructions will be sent shortly.')
    expect(requestCount).toBe(1)
  })

  test('reset password validates mismatch before calling the API', async ({ page }) => {
    let wasCalled = false
    await page.route('**/api/auth/reset-password', async (route) => {
      wasCalled = true
      await route.fulfill(json({ message: 'Your password has been reset. You can now sign in.' }))
    })

    await page.goto('/reset-password?token=sample-token')
    await page.getByLabel('New password').fill('NewStrongPass123!')
    await page.getByLabel('Confirm password').fill('DifferentPass123!')
    await page.getByRole('button', { name: /reset password/i }).click()

    await expect(page.getByRole('alert')).toContainText('New password and confirmation password must match.')
    expect(wasCalled).toBeFalsy()
  })

  test('reset password success links back to login', async ({ page }) => {
    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill(json({ message: 'Your password has been reset. You can now sign in.' }))
    })

    await page.goto('/reset-password?token=sample-token')
    await page.getByLabel('New password').fill('NewStrongPass123!')
    await page.getByLabel('Confirm password').fill('NewStrongPass123!')
    await page.getByRole('button', { name: /reset password/i }).click()

    await expect(page.getByRole('status')).toContainText('Your password has been reset. You can now sign in.')
    await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible()
  })

  test('invalid or expired reset link shows clear message', async ({ page }) => {
    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill(json({ message: 'This password reset link is invalid or has expired. Please request a new one.' }, 403))
    })

    await page.goto('/reset-password?token=expired-token')
    await page.getByLabel('New password').fill('NewStrongPass123!')
    await page.getByLabel('Confirm password').fill('NewStrongPass123!')
    await page.getByRole('button', { name: /reset password/i }).click()

    await expect(page.getByRole('alert')).toContainText('This password reset link is invalid or has expired. Please request a new one.')
  })
})
