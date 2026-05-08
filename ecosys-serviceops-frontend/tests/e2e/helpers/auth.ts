import { expect, type Page } from '@playwright/test'
import {
  E2E_API_URL,
  E2E_PLATFORM_EMAIL,
  E2E_PLATFORM_PASSWORD,
  E2E_TENANT_EMAIL,
  E2E_TENANT_PASSWORD,
} from './test-data'

function requireCredentials(email: string, password: string, label: string) {
  if (!email || !password) {
    throw new Error(
      `${label} credentials are missing. Set environment variables before running this suite.`,
    )
  }
}

async function login(page: Page, email: string, password: string, expectedUrl: RegExp, expectedVisible: { testId?: string; heading?: RegExp }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /^login$/i }).click()

  const errorBanner = page.locator('text=/login failed|enter your email and password/i').first()

  await expect
    .poll(
      async () => {
        if (await errorBanner.isVisible().catch(() => false)) {
          return 'LOGIN_ERROR'
        }
        const url = page.url()
        if (expectedUrl.test(url)) {
          return 'OK'
        }
        return url
      },
      {
        message: `Login did not reach expected route: ${expectedUrl}`,
        timeout: 20000,
      },
    )
    .toBe('OK')

  if (expectedVisible.testId) {
    await expect(page.getByTestId(expectedVisible.testId)).toBeVisible()
  }
  if (expectedVisible.heading) {
    await expect(page.getByRole('heading', { name: expectedVisible.heading })).toBeVisible()
  }
}

export async function loginAsPlatformOwner(page: Page) {
  requireCredentials(E2E_PLATFORM_EMAIL, E2E_PLATFORM_PASSWORD, 'Platform owner')
  await login(page, E2E_PLATFORM_EMAIL, E2E_PLATFORM_PASSWORD, /\/(platform|command-centre)/, {
    testId: 'command-centre-sidebar',
    heading: /overview|settings|tenants|finance|licenses/i,
  })
}

export async function loginAsTenantAdmin(page: Page) {
  if (E2E_TENANT_EMAIL && E2E_TENANT_PASSWORD) {
    await login(page, E2E_TENANT_EMAIL, E2E_TENANT_PASSWORD, /\/(dashboard|settings)/, {
      heading: /dashboard|settings/i,
    })
    return
  }

  const suffix = Date.now()
  const signupEmail = `e2e.tenant.${suffix}@example.com`
  const signupPassword = `E2E!Tenant${suffix}`

  const token = await page.evaluate(
    async ({ apiUrl, email, password, companyName, fullName }) => {
      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          fullName,
          email,
          password,
          industry: 'Facilities',
          country: 'Kenya',
        }),
      })

      if (!response.ok) {
        throw new Error(`Signup failed with status ${response.status}`)
      }

      const data = await response.json() as { token?: string }
      if (!data.token) {
        throw new Error('Signup response did not include a token.')
      }

      return data.token
    },
    {
      apiUrl: E2E_API_URL,
      email: signupEmail,
      password: signupPassword,
      companyName: `E2E Tenant ${suffix}`,
      fullName: `E2E Admin ${suffix}`,
    },
  )

  await page.addInitScript((authToken) => {
    window.localStorage.setItem('ecosys.serviceops.auth', JSON.stringify({ token: authToken, mode: 'local' }))
  }, token)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
}
