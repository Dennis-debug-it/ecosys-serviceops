import { expect, test } from '@playwright/test'
import { loginAsPlatformOwner } from './helpers/auth'

const hasPlatformCreds = Boolean(process.env.E2E_PLATFORM_EMAIL || process.env.E2E_SUPERADMIN_EMAIL)

const forbiddenTexts = [
  /API not available yet/i,
  /placeholder/i,
  /mock data/i,
  /Work order summary placeholder/i,
  /coming soon/i,
  /quotation/i,
  /invoice/i,
  /billing/i,
]

function assertNoForbiddenText(page: import('@playwright/test').Page) {
  return Promise.all(forbiddenTexts.map(async (pattern) => {
    await expect(page.getByText(pattern)).toHaveCount(0)
  }))
}

test.describe('Command Centre smoke', () => {
  test.skip(!hasPlatformCreds, 'Set platform owner credentials to run command centre tests.')

  test.beforeEach(async ({ page }) => {
    await loginAsPlatformOwner(page)
  })

  test('dashboard loads with sidebar and no placeholder content', async ({ page }) => {
    await page.goto('/platform')

    await expect(page.getByTestId('command-centre-sidebar')).toBeVisible()
    await expect(page.getByTestId('command-centre-dashboard')).toBeVisible()

    await expect(page.getByText(/total tenants/i)).toBeVisible()
    await assertNoForbiddenText(page)
  })

  test('platform navigation works for command centre areas', async ({ page }) => {
    const requiredRoutes: Array<{ label: RegExp; url: RegExp }> = [
      { label: /overview|dashboard/i, url: /\/platform(?:\?.*)?$/ },
      { label: /tenants/i, url: /\/platform\/tenants/ },
      { label: /platform users/i, url: /\/platform\/users/ },
      { label: /^reports$/i, url: /\/platform\/reports/ },
      { label: /audit logs/i, url: /\/platform\/audit-logs/ },
      { label: /^settings$/i, url: /\/platform\/settings/ },
      { label: /licenses\s*&\s*subscriptions/i, url: /\/platform\/licenses/ },
    ]

    for (const item of requiredRoutes) {
      await page.getByRole('link', { name: item.label }).click()
      await expect(page).toHaveURL(item.url)
      await assertNoForbiddenText(page)
    }
  })
})
