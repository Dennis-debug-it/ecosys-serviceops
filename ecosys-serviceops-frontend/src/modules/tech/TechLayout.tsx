import { LogOut, Wrench } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function TechLayout() {
  const { session, logout } = useAuth()

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-40 border-b border-app bg-app/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Technician mode</p>
            <h1 className="text-lg font-semibold text-app">{session?.tenantName || 'ServiceOps'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/tech" className="button-secondary">
              <Wrench className="size-4" />
              My jobs
            </NavLink>
            <button type="button" className="button-secondary" onClick={() => void logout()}>
              <LogOut className="size-4" />
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
