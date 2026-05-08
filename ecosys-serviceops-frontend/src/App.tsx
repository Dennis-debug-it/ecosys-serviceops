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
  { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'user'] as const, permission: null, icon: LayoutDashboard },
  { label: 'Work Orders', path: '/work-orders', roles: ['admin', 'user'] as const, permission: 'canViewWorkOrders' as const, icon: ClipboardList },
  { label: 'Clients', path: '/clients', roles: ['admin', 'user'] as const, permission: null, icon: Building2 },
  { label: 'Assets', path: '/assets', roles: ['admin', 'user'] as const, permission: 'canManageAssets' as const, icon: Boxes },
  { label: 'Materials', path: '/materials', roles: ['admin', 'user'] as const, permission: null, icon: Package },
  { label: 'Preventive Maintenance', path: '/preventive-maintenance', roles: ['admin', 'user'] as const, permission: null, icon: Wrench },
  { label: 'Templates', path: '/templates', roles: ['admin', 'user'] as const, permission: null, icon: Activity },
  { label: 'Reports', path: '/reports', roles: ['admin', 'user'] as const, permission: 'canViewReports' as const, icon: Activity },
  { label: 'Settings', path: '/settings', roles: ['admin'] as const, permission: 'canManageSettings' as const, icon: Settings2 },
  { label: 'Overview', path: '/platform', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: ShieldCheck },
  { label: 'Tenants', path: '/platform/tenants', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: Building2 },
  { label: 'Leads & Enquiries', path: '/platform/leads', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: Users },
  { label: 'Licenses & Subscriptions', path: '/platform/licenses', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: FileText },
  { label: 'Platform Users', path: '/platform/users', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: Users },
  { label: 'Reports', path: '/platform/reports', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: Activity },
  { label: 'Audit Logs', path: '/platform/audit-logs', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: FileText },
  { label: 'Settings', path: '/platform/settings', roles: ['superadmin'] as const, permission: 'canViewPlatformTenants' as const, icon: Settings2 },
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

  return <Navigate to={session.role === 'superadmin' ? '/platform' : '/dashboard'} replace />
}

function NotFoundPage() {
  const location = useLocation()
  const { session } = useAuth()
  const fallbackPath = session?.role === 'superadmin' ? '/platform' : session ? '/dashboard' : '/login'

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

  if (session.role === 'superadmin') {
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

  if (session.role !== 'admin' || !session.permissions?.canManageSettings) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet context={shellContext} />
}

function SuperadminOnlyRoute() {
  const { isReady, session } = useAuth()
  const shellContext = useOutletContext<ShellOutletContext>()

  if (!isReady) {
    return <RouteLoading label="Checking platform access" />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.role !== 'superadmin' || !session.permissions?.canViewPlatformTenants) {
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

  const routeAllowedForSession = (roles: readonly ('admin' | 'user' | 'superadmin')[], permission: string | null) => {
    if (!session) return false
    if (!roles.includes(session.role)) return false
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
    if (!session || session.role === 'superadmin') return []
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
      mode={session.role === 'superadmin' ? 'platform' : 'tenant'}
      navItems={navItems}
      session={session}
      tenantName={session.role === 'superadmin' ? 'Ecosys Platform' : session.tenantName}
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

              <Route element={<SuperadminOnlyRoute />}>
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
