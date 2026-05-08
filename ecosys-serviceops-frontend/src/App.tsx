import { lazy, Suspense, useEffect, useMemo } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import {
  Activity,
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import type { ShellOutletContext } from './components/layout/AppShell'
import { LoadingState } from './components/ui/LoadingState'
import { ToastProvider } from './components/ui/ToastProvider'
import { ThemeProvider } from './context/ThemeContext'
import { GuestRoute } from './routes/GuestRoute'
import type { NotificationItem, SearchItem } from './types/app'
import { SettingsLayout } from './pages/settings/SettingsLayout'
import { defaultSettingsSegment, settingsLegacyRedirects, settingsPageRoutes } from './pages/settings/routes'
import { installInteractionDebugLogger } from './utils/appCleanup'
import { isPlatformRole, isTenantAdminRole, isTenantWorkspaceRole, PLATFORM_ROLES, TENANT_USER_ROLES } from './utils/constants'

const LoginPage = lazy(async () => ({ default: (await import('./modules/auth/LoginPage')).LoginPage }))
const SignupPage = lazy(async () => ({ default: (await import('./modules/auth/SignupPage')).SignupPage }))
const PlatformLeadsPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformLeadsPage')).PlatformLeadsPage }))
const DashboardPage = lazy(async () => ({ default: (await import('./modules/dashboard/DashboardPage')).DashboardPage }))
const WorkOrdersPage = lazy(async () => ({ default: (await import('./modules/work-orders/WorkOrdersPage')).WorkOrdersPage }))
const WorkOrderDetailPage = lazy(async () => ({ default: (await import('./modules/work-orders/WorkOrderDetailPage')).WorkOrderDetailPage }))
const ClientsPage = lazy(async () => ({ default: (await import('./modules/clients/ClientsPage')).ClientsPage }))
const AssetsPage = lazy(async () => ({ default: (await import('./modules/assets/AssetsPage')).AssetsPage }))
const MaterialsPage = lazy(async () => ({ default: (await import('./modules/materials/MaterialsPage')).MaterialsPage }))
const PreventiveMaintenancePage = lazy(async () => ({ default: (await import('./modules/preventive-maintenance/PreventiveMaintenancePage')).PreventiveMaintenancePage }))
const TemplatesPage = lazy(async () => ({ default: (await import('./modules/templates/TemplatesPage')).TemplatesPage }))
const ReportsPage = lazy(async () => ({ default: (await import('./modules/reports/ReportsPage')).ReportsPage }))
const PlatformLayout = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformLayout')).PlatformLayout }))
const PlatformOverviewPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformOverviewAndLicensesPages')).PlatformOverviewPage }))
const PlatformLicensesPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformOverviewAndLicensesPages')).PlatformLicensesPage }))
const PlatformTenantsPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformTenantsPage')).PlatformTenantsPage }))
const PlatformUsersPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformOperationsPages')).PlatformUsersPage }))
const PlatformReportsPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformOperationsPages')).PlatformReportsPage }))
const PlatformAuditLogsPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformOperationsPages')).PlatformAuditLogsPage }))
const PlatformSettingsPage = lazy(async () => ({ default: (await import('./modules/platform-v2/PlatformOperationsPages')).PlatformSettingsPage }))

const routeCatalog = [
  { label: 'Dashboard', path: '/dashboard', roles: TENANT_USER_ROLES, permission: null, icon: LayoutDashboard },
  { label: 'Work Orders', path: '/work-orders', roles: TENANT_USER_ROLES, permission: 'canViewWorkOrders' as const, icon: ClipboardList },
  { label: 'Clients', path: '/clients', roles: TENANT_USER_ROLES, permission: null, icon: Building2 },
  { label: 'Assets', path: '/assets', roles: TENANT_USER_ROLES, permission: 'canManageAssets' as const, icon: Boxes },
  { label: 'Materials', path: '/materials', roles: TENANT_USER_ROLES, permission: null, icon: Package },
  { label: 'Preventive Maintenance', path: '/preventive-maintenance', roles: TENANT_USER_ROLES, permission: null, icon: Wrench },
  { label: 'Templates', path: '/templates', roles: TENANT_USER_ROLES, permission: null, icon: Activity },
  { label: 'Reports', path: '/reports', roles: TENANT_USER_ROLES, permission: 'canViewReports' as const, icon: Activity },
  { label: 'Settings', path: '/settings', roles: ['tenantadmin', 'admin'] as const, permission: 'canManageSettings' as const, icon: Settings2 },
  { label: 'Overview', path: '/platform', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: ShieldCheck },
  { label: 'Tenants', path: '/platform/tenants', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: Building2 },
  { label: 'Leads & Enquiries', path: '/platform/leads', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: Users },
  { label: 'Licenses & Subscriptions', path: '/platform/licenses', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: FileText },
  { label: 'Platform Users', path: '/platform/users', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: Users },
  { label: 'Reports', path: '/platform/reports', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: Activity },
  { label: 'Audit Logs', path: '/platform/audit-logs', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: FileText },
  { label: 'Settings', path: '/platform/settings', roles: PLATFORM_ROLES, permission: 'canViewPlatformTenants' as const, icon: Settings2 },
] as const

function RouteLoading({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-app p-4 sm:p-6 lg:p-8">
      <LoadingState label={label} />
    </div>
  )
}

function HomeRedirect() {
  const { isReady, session } = useAuth()

  if (!isReady) {
    return <RouteLoading label="Opening ServiceOps" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={isPlatformRole(session.role) ? '/platform' : '/dashboard'} replace />
}

function NotFoundPage() {
  const location = useLocation()
  const { session } = useAuth()
  const fallbackPath = session ? (isPlatformRole(session.role) ? '/platform' : '/dashboard') : '/login'

  return (
    <div className="min-h-screen bg-app p-4 sm:p-6 lg:p-8">
      <div className="surface-card mx-auto max-w-2xl">
        <p className="eyebrow-accent text-xs font-semibold uppercase tracking-[0.2em]">Not Found</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-app">That route does not exist</h1>
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-app">{location.pathname}</span> is not a valid ServiceOps route.
        </p>
        <div className="mt-6">
          <Link to={fallbackPath} className="button-primary">
            Go back
          </Link>
        </div>
      </div>
    </div>
  )
}

function TenantOnlyRoute() {
  const { isReady, session } = useAuth()
  const shellContext = useOutletContext<ShellOutletContext>()

  if (!isReady) {
    return <RouteLoading label="Checking tenant access" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (isPlatformRole(session.role)) {
    return <Navigate to="/platform" replace />
  }

  return <Outlet context={shellContext} />
}

function AdminOnlyRoute() {
  const { isReady, session } = useAuth()
  const shellContext = useOutletContext<ShellOutletContext>()

  if (!isReady) {
    return <RouteLoading label="Checking admin access" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isTenantAdminRole(session.role) || !session.permissions?.canManageSettings) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet context={shellContext} />
}

function PlatformOnlyRoute() {
  const { isReady, session } = useAuth()
  const shellContext = useOutletContext<ShellOutletContext>()

  if (!isReady) {
    return <RouteLoading label="Checking platform access" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isPlatformRole(session.role) || !session.permissions?.canViewPlatformTenants) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet context={shellContext} />
}

function AuthenticatedRouteBoundary() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  )
}

function AuthenticatedShell() {
  const { isReady, session } = useAuth()

  const routeAllowedForSession = (roles: readonly string[], permission: string | null) => {
    if (!session) return false
    if (roles === PLATFORM_ROLES) {
      if (!isPlatformRole(session.role)) return false
    } else if (roles === TENANT_USER_ROLES) {
      if (!isTenantWorkspaceRole(session.role)) return false
    } else if (!roles.includes(session.role)) {
      return false
    }
    if (!permission) return true
    return Boolean(session.permissions?.[permission as keyof NonNullable<typeof session.permissions>])
  }

  const searchItems = useMemo<SearchItem[]>(() => {
    if (!session) return []

    return routeCatalog
      .filter((item) => routeAllowedForSession(item.roles, item.permission))
      .map((item) => ({
        id: item.path,
        title: item.label,
        subtitle: item.path,
        path: item.path,
        roles: [session.role],
      }))
  }, [session])

  const navItems = useMemo(() => {
    if (!session) return []

    return routeCatalog
      .filter((item) => routeAllowedForSession(item.roles, item.permission))
      .map(({ label, path, icon }) => ({ label, path, icon }))
  }, [session])

  const notifications = useMemo<NotificationItem[]>(() => [], [])

  const branches = useMemo(() => {
    if (!session || isPlatformRole(session.role)) return []
    const mapped = (session.branches ?? []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      region: branch.location ?? '',
      city: branch.location ?? '',
      active: branch.isActive,
      siteCount: 0,
    }))
    return [
      { id: 'all', name: 'All Branches', code: 'ALL', region: '', city: '', active: true, siteCount: 0 },
      ...mapped,
    ]
  }, [session])

  if (!isReady || !session) {
    return <RouteLoading label="Loading workspace shell" />
  }

  return (
    <AppShell
      mode={isPlatformRole(session.role) ? 'platform' : 'tenant'}
      navItems={navItems}
      session={session}
      tenantName={isPlatformRole(session.role) ? 'Ecosys Platform' : session.tenantName}
      branches={branches}
      notifications={notifications}
      searchItems={searchItems}
    />
  )
}

function AppRoutes() {
  useEffect(() => installInteractionDebugLogger(), [])
  useEffect(() => {
    document.title = 'Ecosys'
  }, [])

  return (
    <Suspense fallback={<RouteLoading label="Loading page" />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/get-started" element={<SignupPage />} />
          <Route path="/signup" element={<Navigate to="/get-started" replace />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AuthenticatedRouteBoundary />}>
            <Route element={<AuthenticatedShell />}>
              <Route element={<TenantOnlyRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/work-orders" element={<WorkOrdersPage />} />
                <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/materials" element={<MaterialsPage />} />
                <Route path="/preventive-maintenance" element={<PreventiveMaintenancePage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

              <Route element={<AdminOnlyRoute />}>
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route index element={<Navigate to={defaultSettingsSegment} replace />} />
                  {settingsLegacyRedirects.map((route) => (
                    <Route key={route.from} path={route.from} element={<Navigate to={`/settings/${route.to}`} replace />} />
                  ))}
                  {settingsPageRoutes.map((route) => (
                    <Route key={route.path} path={route.path} element={route.element} />
                  ))}
                </Route>
              </Route>

              <Route element={<PlatformOnlyRoute />}>
                <Route path="/platform" element={<PlatformLayout />}>
                  <Route index element={<PlatformOverviewPage />} />
                  <Route path="tenants" element={<PlatformTenantsPage />} />
                  <Route path="leads" element={<PlatformLeadsPage />} />
                  <Route path="licenses" element={<PlatformLicensesPage />} />
                  <Route path="users" element={<PlatformUsersPage />} />
                  <Route path="reports" element={<PlatformReportsPage />} />
                  <Route path="audit-logs" element={<PlatformAuditLogsPage />} />
                  <Route path="settings" element={<PlatformSettingsPage />} />
                </Route>

                <Route path="/command-centre" element={<Navigate to="/platform" replace />} />
                <Route path="/command-centre/tenants" element={<Navigate to="/platform/tenants" replace />} />
                <Route path="/command-centre/leads" element={<Navigate to="/platform/leads" replace />} />
                <Route path="/command-centre/licenses" element={<Navigate to="/platform/licenses" replace />} />
                <Route path="/command-centre/reports" element={<Navigate to="/platform/reports" replace />} />
                <Route path="/command-centre/platform-users" element={<Navigate to="/platform/users" replace />} />
                <Route path="/command-centre/audit-logs" element={<Navigate to="/platform/audit-logs" replace />} />
                <Route path="/command-centre/settings" element={<Navigate to="/platform/settings" replace />} />
                <Route path="/platform/finance" element={<Navigate to="/platform" replace />} />
                <Route path="/platform/finance/*" element={<Navigate to="/platform" replace />} />
                <Route path="/command-centre/quotations" element={<Navigate to="/platform" replace />} />
                <Route path="/command-centre/invoices" element={<Navigate to="/platform" replace />} />
                <Route path="/command-centre/payments" element={<Navigate to="/platform" replace />} />
                <Route path="/command-centre/revenue" element={<Navigate to="/platform" replace />} />
                <Route path="/command-centre/expenses" element={<Navigate to="/platform" replace />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
