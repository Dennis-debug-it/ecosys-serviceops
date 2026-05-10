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

async function mockForcedPasswordChange(page: Page, role: 'Admin' | 'SuperAdmin' = 'Admin') {
  const isPlatform = role === 'SuperAdmin'
  const permissions = isPlatform
    ? {
        canViewPlatformTenants: true,
        canCreatePlatformTenants: true,
        canEditPlatformTenants: true,
        canUpdatePlatformTenantStatus: true,
        canDeactivatePlatformTenants: true,
      }
    : {
        canViewWorkOrders: true,
        canCreateWorkOrders: true,
        canAssignWorkOrders: true,
        canCompleteWorkOrders: true,
        canApproveMaterials: true,
        canIssueMaterials: true,
        canManageAssets: true,
        canManageSettings: true,
        canViewReports: true,
      }

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill(json({
      token: `${role.toLowerCase()}-temporary-token`,
      user: {
        role,
        mustChangePassword: true,
        permissions,
      },
      tenant: {
        companyName: isPlatform ? 'Ecosys Platform' : 'Acme Facilities',
      },
    }))
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill(json({
      user: {
        userId: `${role.toLowerCase()}-1`,
        fullName: isPlatform ? 'Platform Owner' : 'Tenant Admin',
        email: isPlatform ? 'superadmin@ecosys.local' : 'admin@acme.test',
        role,
        mustChangePassword: true,
        hasAllBranchAccess: true,
        permissions,
      },
      tenant: {
        tenantId: isPlatform ? 'platform-root' : 'tenant-1',
        companyName: isPlatform ? 'Ecosys Platform' : 'Acme Facilities',
        country: 'Kenya',
      },
      branches: [],
    }))
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

    await expect(page.getByRole('alert')).toContainText('Wrong email or password. Please check your details and try again.')
    await expect(page.getByRole('alert')).not.toContainText('traceId')
    await expect(page.locator('body')).not.toContainText('https://tools.ietf.org/html/rfc9110')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: /^login$/i })).toBeEnabled()
    await expect(page.getByLabel('Email')).toHaveValue('wrong@ecosys.test')
    await expect(page.getByLabel('Password')).toHaveValue('')
  })

  test('legacy 403 login failure still shows the same friendly message', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill(json({
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.4',
        title: 'Invalid email or password.',
        status: 403,
        traceId: '00-test',
      }, 403))
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill('wrong@ecosys.test')
    await page.getByLabel('Password').fill('incorrect')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page.getByRole('alert')).toContainText('Wrong email or password. Please check your details and try again.')
    await expect(page.locator('body')).not.toContainText('traceId')
    await expect(page.locator('body')).not.toContainText('rfc9110')
  })

  test('network failure shows server unreachable message', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.abort('failed')
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill('wrong@ecosys.test')
    await page.getByLabel('Password').fill('incorrect')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page.getByRole('alert')).toContainText('Unable to reach the server. Please check your connection and try again.')
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

  test('login with mustChangePassword true redirects to /change-password', async ({ page }) => {
    await mockForcedPasswordChange(page)

    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@acme.test')
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page).toHaveURL(/\/change-password$/)
    await expect(page.getByRole('heading', { name: /change your temporary password/i })).toBeVisible()
  })

  test('user cannot access /dashboard while mustChangePassword is true', async ({ page }) => {
    await mockForcedPasswordChange(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@acme.test')
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/change-password$/)
  })

  test('user cannot access /platform while mustChangePassword is true', async ({ page }) => {
    await mockForcedPasswordChange(page, 'SuperAdmin')
    await page.goto('/login')
    await page.getByLabel('Email').fill('superadmin@ecosys.local')
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await page.goto('/platform')
    await expect(page).toHaveURL(/\/change-password$/)
  })

  test('change password page validates mismatch with a friendly error', async ({ page }) => {
    await mockForcedPasswordChange(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@acme.test')
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await page.getByLabel('Current password').fill('TempPass123!')
    await page.getByLabel('New password', { exact: true }).fill('NewStrongPass123!')
    await page.getByLabel('Confirm new password', { exact: true }).fill('DifferentPass123!')
    await page.getByRole('button', { name: /change password/i }).click()

    await expect(page.getByRole('alert')).toContainText('Passwords do not match.')
  })

  test('successful password change redirects tenant user to /dashboard', async ({ page }) => {
    await mockForcedPasswordChange(page)
    await page.route('**/api/auth/change-password', async (route) => {
      await route.fulfill(json({ message: 'Your password has been changed successfully.' }))
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

    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@acme.test')
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await page.getByLabel('Current password').fill('TempPass123!')
    await page.getByLabel('New password', { exact: true }).fill('NewStrongPass123!')
    await page.getByLabel('Confirm new password', { exact: true }).fill('NewStrongPass123!')
    await page.getByRole('button', { name: /change password/i }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('successful password change redirects SuperAdmin to /platform', async ({ page }) => {
    await mockForcedPasswordChange(page, 'SuperAdmin')
    await page.route('**/api/auth/change-password', async (route) => {
      await route.fulfill(json({ message: 'Your password has been changed successfully.' }))
    })
    await page.route('**/api/platform/**', async (route) => {
      await route.fulfill(json([]))
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill('superadmin@ecosys.local')
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: /^login$/i }).click()

    await page.getByLabel('Current password').fill('TempPass123!')
    await page.getByLabel('New password', { exact: true }).fill('NewStrongPass123!')
    await page.getByLabel('Confirm new password', { exact: true }).fill('NewStrongPass123!')
    await page.getByRole('button', { name: /change password/i }).click()

    await expect(page).toHaveURL(/\/platform$/)
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
