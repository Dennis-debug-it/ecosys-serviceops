'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { iconMap } from '@/saas/utils/icons'
import { navigationItems } from '@/saas/mock/data'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { Badge } from '@/saas/components/ui/Badge'

const sectionOrder: Array<'Main' | 'Operations' | 'Settings'> = ['Main', 'Operations', 'Settings']

export function Sidebar() {
  const pathname = usePathname()
  const mobileSidebarOpen = useServiceOpsStore((state) => state.mobileSidebarOpen)
  const setMobileSidebarOpen = useServiceOpsStore((state) => state.setMobileSidebarOpen)

  return (
    <>
      <aside className={`sidebar ${mobileSidebarOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Zap size={18} />
          </div>
          <div>
            <div className="logo-text">Ecosys</div>
            <div className="logo-sub">ServiceOps</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sectionOrder.map((section) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {navigationItems
                .filter((item) => item.section === section)
                .map((item) => {
                  const Icon = iconMap[item.icon]
                  const active = pathname === item.href

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item ${active ? 'active' : ''}`}
                      onClick={() => setMobileSidebarOpen(false)}
                    >
                      <span className="nav-icon">{Icon ? <Icon size={18} /> : null}</span>
                      <span>{item.label}</span>
                      {item.badge ? (
                        item.badgeTone === 'warning' ? (
                          <span className="nav-badge warn">{item.badge}</span>
                        ) : (
                          <span className="nav-badge">{item.badge}</span>
                        )
                      ) : null}
                    </Link>
                  )
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">JD</div>
            <div>
              <div className="user-name">James Doe</div>
              <div className="user-role">Tenant Admin</div>
            </div>
          </div>
          <div className="mt-md">
            <Badge tone="done">Healthy Tenant</Badge>
          </div>
        </div>
      </aside>
      {mobileSidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}
    </>
  )
}
