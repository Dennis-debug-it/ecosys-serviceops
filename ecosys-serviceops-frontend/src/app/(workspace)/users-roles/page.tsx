'use client'

import { ShieldCheck, Users, UserRoundCog, UserRoundMinus } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { UserRecord } from '@/saas/types'

export default function UsersRolesPage() {
  const users = useServiceOpsStore((state) => state.users)

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (row: UserRecord) => (
        <div className="table-person">
          <span className="avatar sm">{row.initials}</span>
          <div>
            <div className="stack-list-title">{row.name}</div>
            <div className="stack-list-subtitle">{row.lastSeen}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row: UserRecord) => row.role,
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row: UserRecord) => row.branch,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: UserRecord) => <Badge tone={statusBadgeTone(row.status)}>{row.status}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/users-roles')}
        title="Users & Roles"
        description="RBAC-ready tenant directory covering admins, dispatchers, managers and technicians."
      />

      <div className="grid-4">
        <div className="metric-card">
          <Users size={18} />
          <div className="summary-value">{users.length}</div>
          <div className="summary-note">Provisioned users</div>
        </div>
        <div className="metric-card">
          <ShieldCheck size={18} />
          <div className="summary-value">{users.filter((user) => user.status === 'Active').length}</div>
          <div className="summary-note">Active identities</div>
        </div>
        <div className="metric-card">
          <UserRoundCog size={18} />
          <div className="summary-value">{users.filter((user) => user.role === 'Tenant Admin').length}</div>
          <div className="summary-note">Tenant administrators</div>
        </div>
        <div className="metric-card">
          <UserRoundMinus size={18} />
          <div className="summary-value">{users.filter((user) => user.status === 'Suspended').length}</div>
          <div className="summary-note">Suspended accounts</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Access Directory</span>
          <span className="text-caption">Role and branch visibility</span>
        </div>
        <DataTable columns={columns} rows={users} rowKey={(row) => row.id} />
      </section>
    </>
  )
}
