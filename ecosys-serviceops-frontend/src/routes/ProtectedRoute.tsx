import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../types/app'
import { roleHomePath } from '../utils/constants'
import { LoadingState } from '../components/ui/LoadingState'

export function ProtectedRoute({ allow }: { allow: Role[] }) {
  const { isAuthenticated, isReady, session } = useAuth()

  if (!isReady) {
    return <LoadingState label="Loading workspace access" />
  }

  if (!isAuthenticated || !session) {
    return <Navigate to="/login" replace />
  }

  if (!allow.includes(session.role)) {
    return <Navigate to={roleHomePath(session.role)} replace />
  }

  return <Outlet />
}
