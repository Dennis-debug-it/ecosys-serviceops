'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, Menu, MonitorCog, Search, SunMoon } from 'lucide-react'
import { getBreadcrumbs, themeLabel } from '@/saas/utils/formatters'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'

export function Topbar() {
  const pathname = usePathname()
  const tenant = useServiceOpsStore((state) => state.tenant)
  const searchQuery = useServiceOpsStore((state) => state.searchQuery)
  const setSearchQuery = useServiceOpsStore((state) => state.setSearchQuery)
  const toggleTheme = useServiceOpsStore((state) => state.toggleTheme)
  const theme = useServiceOpsStore((state) => state.theme)
  const setMobileSidebarOpen = useServiceOpsStore((state) => state.setMobileSidebarOpen)
  const notifications = useServiceOpsStore((state) => state.notifications)
  const currentPath = pathname ?? '/dashboard'

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn topbar-mobile-trigger"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>
      <label className="topbar-search">
        <Search size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search work orders, assets, clients... (/)"
          aria-label="Search workspace"
        />
        <span className="search-shortcut">/</span>
      </label>
      <div className="topbar-actions">
        <div className="tenant-badge">
          <span className="tenant-dot" /> {tenant.name}
          <ChevronDown size={14} />
        </div>
        <button type="button" className="icon-btn" aria-label="Notifications">
          <Bell size={18} />
          {notifications.length > 0 ? <span className="dot" /> : null}
        </button>
        <button type="button" className="icon-btn" aria-label={themeLabel(theme)} onClick={toggleTheme}>
          <SunMoon size={18} />
        </button>
        <Link href="/dashboard#command-centre" className="icon-btn" aria-label="Command Centre preview">
          <MonitorCog size={18} />
        </Link>
      </div>
      <div className="topbar-breadcrumb-mobile">
        {getBreadcrumbs(currentPath)
          .slice(-1)
          .map((crumb) => (
            <span key={crumb.label}>{crumb.label}</span>
          ))}
      </div>
    </header>
  )
}
