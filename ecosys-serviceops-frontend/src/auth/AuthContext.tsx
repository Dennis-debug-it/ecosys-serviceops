import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearStoredAuth, getStoredAuth, onUnauthorized, persistAuthToken } from '../lib/api'
import { authService, type LoginInput, type SignupInput } from '../services/authService'
import type { ApiBranch, ApiPermissions, ApiRole } from '../types/api'
import type { AppSession, AuthBranch, Role } from '../types/app'
import { asBoolean, asNullableString, asString, normalizeBranches, normalizePermissions, pickRecord } from '../utils/apiDefaults'
import { cleanupBodyInteractivity, clearTransientAppState, dispatchUiReset } from '../utils/appCleanup'

const SESSION_STORAGE_KEY = 'ecosys.serviceops.session'

type AuthContextValue = {
  session: AppSession | null
  currentUser: AppSession | null
  role: Role | null
  tenant: { id?: string; name: string; code: string } | null
  permissions: ApiPermissions | null
  branches: AuthBranch[]
  isAuthenticated: boolean
  isReady: boolean
  loading: boolean
  canAccess: (roles: Role[]) => boolean
  login: (input: LoginInput) => Promise<AppSession>
  signup: (input: SignupInput) => Promise<AppSession>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeRole(role: string): ApiRole {
  const normalized = role.trim().toLowerCase()
  if (normalized === 'superadmin' || normalized === 'super_admin') return 'superadmin'
  if (normalized === 'admin') return 'admin'
  return 'user'
}

function createAvatar(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'ES'
}

function mapBranches(branches: ApiBranch[]): AuthBranch[] {
  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    location: branch.location ?? null,
    isActive: branch.isActive,
  }))
}

function buildSessionFromMe(payload: unknown, token: string): AppSession {
  const root = pickRecord(payload) ?? {}
  const user = pickRecord(root.user, payload) ?? {}
  const tenant = pickRecord(root.tenant, payload) ?? {}
  const role = normalizeRole(asString(user.role ?? root.role, 'user'))
  const name = asString(user.fullName ?? user.name ?? root.fullName ?? root.name, 'Ecosys User')
  const email = asString(user.email ?? user.emailAddress ?? root.email ?? root.emailAddress, '')
  const permissions = normalizePermissions(user.permissions ?? root.permissions)
  const branches = normalizeBranches(root.branches ?? tenant.branches)
  const tenantId = asString(tenant.tenantId ?? root.tenantId)
  const tenantName = asString(tenant.companyName ?? tenant.name ?? root.companyName ?? root.tenantName, role === 'superadmin' ? 'Ecosys Platform' : 'Workspace')
  const jobTitle = asNullableString(user.jobTitle ?? root.jobTitle)
  const department = asNullableString(user.department ?? root.department)

  return {
    id: asString(user.userId ?? user.id ?? root.userId ?? root.id),
    accountId: asString(user.userId ?? user.id ?? root.userId ?? root.id),
    token,
    userId: asString(user.userId ?? user.id ?? root.userId ?? root.id),
    tenantId,
    name,
    email,
    role,
    tenantName,
    tenantCode: '',
    title: jobTitle || (role === 'superadmin' ? 'Platform Owner' : role === 'admin' ? 'Administrator' : 'User'),
    branchId: asNullableString(user.defaultBranchId ?? root.defaultBranchId) ?? undefined,
    avatar: createAvatar(name),
    sessionStartedAt: new Date().toISOString(),
    permissions,
    branches: mapBranches(branches),
    department: department ?? undefined,
    hasAllBranchAccess: asBoolean(user.hasAllBranchAccess ?? root.hasAllBranchAccess),
    country: asNullableString(tenant.country ?? root.country) ?? undefined,
    industry: asNullableString(tenant.industry ?? root.industry) ?? undefined,
    logoUrl: asNullableString(tenant.logoUrl ?? root.logoUrl),
  }
}

function readStoredSession() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AppSession
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

function persistSession(session: AppSession | null) {
  if (typeof window === 'undefined') return
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function clearLocalSessionState() {
  clearStoredAuth()
  persistSession(null)
  clearTransientAppState()
  cleanupBodyInteractivity()
  dispatchUiReset()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(() => readStoredSession())
  const [loading, setLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    onUnauthorized(() => {
      cleanupBodyInteractivity()
      setSession(null)
      setLoading(false)
      setIsReady(true)
      persistSession(null)
      clearTransientAppState()
      dispatchUiReset()
    })
    return () => onUnauthorized(null)
  }, [])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    async function bootstrap() {
      const storedAuth = getStoredAuth()

      if (!storedAuth?.token) {
        if (mounted) {
          cleanupBodyInteractivity()
          setSession(null)
          setLoading(false)
          setIsReady(true)
        }
        return
      }

      try {
        const me = await authService.getCurrentUser(controller.signal)
        if (!mounted) return
        const nextSession = buildSessionFromMe(me, storedAuth.token)
        setSession(nextSession)
        persistSession(nextSession)
      } catch {
        if (!mounted) return
        clearLocalSessionState()
        setSession(null)
      } finally {
        if (mounted) {
          setLoading(false)
          setIsReady(true)
        }
      }
    }

    void bootstrap()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      currentUser: session,
      role: session?.role ?? null,
      tenant: session
        ? {
            id: session.tenantId,
            name: session.tenantName,
            code: session.tenantCode,
          }
        : null,
      permissions: session?.permissions ?? null,
      branches: session?.branches ?? [],
      isAuthenticated: Boolean(session?.token),
      isReady,
      loading,
      canAccess: (roles) => Boolean(session && roles.includes(session.role)),
      login: async (input) => {
        cleanupBodyInteractivity()
        dispatchUiReset()
        setLoading(true)
        setIsReady(false)
        try {
          const loginResponse = await authService.login(input)
          persistAuthToken(loginResponse.token)
          const me = await authService.getCurrentUser()
          const nextSession = buildSessionFromMe(me, loginResponse.token)
          setSession(nextSession)
          persistSession(nextSession)
          cleanupBodyInteractivity()
          setIsReady(true)
          return nextSession
        } catch (error) {
          clearLocalSessionState()
          setSession(null)
          setIsReady(true)
          throw error
        } finally {
          setLoading(false)
        }
      },
      signup: async (input) => {
        cleanupBodyInteractivity()
        dispatchUiReset()
        setLoading(true)
        setIsReady(false)
        try {
          const signupResponse = await authService.signup(input)
          persistAuthToken(signupResponse.token)
          const me = await authService.getCurrentUser()
          const nextSession = buildSessionFromMe(me, signupResponse.token)
          setSession(nextSession)
          persistSession(nextSession)
          cleanupBodyInteractivity()
          setIsReady(true)
          return nextSession
        } catch (error) {
          clearLocalSessionState()
          setSession(null)
          setIsReady(true)
          throw error
        } finally {
          setLoading(false)
        }
      },
      logout: async () => {
        setLoading(true)
        setIsReady(false)
        setSession(null)
        clearLocalSessionState()
        try {
          await authService.logout()
        } finally {
          cleanupBodyInteractivity()
          setLoading(false)
          setIsReady(true)
        }
      },
    }),
    [isReady, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
