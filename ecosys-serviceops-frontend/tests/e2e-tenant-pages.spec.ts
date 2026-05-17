import { expect, test } from '@playwright/test'
import { loginViaUi, signupViaApi } from './helpers/auth'
import {
  DEFAULT_SIGNUP_PASSWORD,
  E2E_API_BASE_URL,
  TENANT_EMAIL,
  TENANT_PASSWORD,
} from './helpers/env'
import { installPageGuards } from './helpers/networkGuards'
import { buildSignupData } from './helpers/random'

type Credentials = {
  email: string
  password: string
}

const tenantPages = [
  { name: 'dashboard', path: '/dashboard', heading: /operational overview/i },
  { name: 'clients', path: '/clients', heading: /client register/i },
  { name: 'assets', path: '/assets', heading: /asset register/i },
  { name: 'work orders', path: '/work-orders', heading: /work orders/i },
  { name: 'materials', path: '/materials', heading: /materials and stock/i },
] as const

let tenantCredentials: Credentials

test.beforeAll(async ({ request }) => {
  if (TENANT_EMAIL && TENANT_PASSWORD) {
    tenantCredentials = { email: TENANT_EMAIL, password: TENANT_PASSWORD }
    return
  }

  const signupData = buildSignupData()
  signupData.password = DEFAULT_SIGNUP_PASSWORD
  await signupViaApi(request, E2E_API_BASE_URL, signupData)
  tenantCredentials = {
    email: signupData.email,
    password: signupData.password,
  }
})

for (const route of tenantPages) {
  test(`tenant smoke: ${route.name} page loads`, async ({ page, baseURL }) => {
    const guards = installPageGuards(page, { appBaseUrl: baseURL, apiBaseUrl: E2E_API_BASE_URL })
    try {
      guards.markAuthenticated()
      await loginViaUi(page, tenantCredentials)
      await page.goto(route.path)
      await expect(page).toHaveURL(new RegExp(`${route.path.replace('/', '\\/')}($|\\?)`))
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
    } finally {
      guards.assertNoViolations()
      guards.dispose()
    }
  })
}

test('tenant smoke: settings root page loads', async ({ page, baseURL }) => {
  const guards = installPageGuards(page, { appBaseUrl: baseURL, apiBaseUrl: E2E_API_BASE_URL })
  try {
    guards.markAuthenticated()
    await loginViaUi(page, tenantCredentials)
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/company-profile/)
    await expect(page.getByRole('heading', { name: /company profile/i, level: 1 })).toBeVisible()
  } finally {
    guards.assertNoViolations()
    guards.dispose()
  }
})

test('tenant smoke: assignment groups page loads', async ({ page, baseURL }) => {
  const guards = installPageGuards(page, { appBaseUrl: baseURL, apiBaseUrl: E2E_API_BASE_URL })
  try {
    guards.markAuthenticated()
    await loginViaUi(page, tenantCredentials)
    await page.goto('/settings/assignment-groups')
    await expect(page).toHaveURL(/\/settings\/assignment-groups/)
    await expect(page.getByRole('heading', { name: /assignment groups/i }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /users & roles/i })).toBeVisible()
  } finally {
    guards.assertNoViolations()
    guards.dispose()
  }
})
