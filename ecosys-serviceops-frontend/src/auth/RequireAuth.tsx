import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from '../types/app'
import { roleHomePath } from '../utils/constants'
import { LoadingState } from '../components/ui/LoadingState'

export function RequireAuth({ allow }: { allow?: Role[] }) {
  const location = useLocation()
  const { isAuthenticated, isReady, session } = useAuth()

  if (!isReady) {
    return <LoadingState label="Loading your ServiceOps workspace" />
  }

  if (!isAuthenticated || !session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allow && !allow.includes(session.role)) {
    return <Navigate to={roleHomePath(session.role)} replace />
  }

  return <Outlet />
}
