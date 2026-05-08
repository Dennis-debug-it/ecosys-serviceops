import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'

const cards = [
  {
    title: 'Users',
    description: 'Create tenant users, assign branch access, and update role-based permissions.',
    path: '/settings/users',
  },
  {
    title: 'Branches / Outlets',
    description: 'Manage tenant branches and outlet contact details.',
    path: '/settings/branches',
  },
  {
    title: 'Permissions',
    description: 'Review and update operational permission flags without exposing platform data.',
    path: '/settings/permissions',
  },
]

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Settings"
        title="Tenant configuration"
        description="Manage tenant users, branches, permissions, and operational controls."
      />
      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.path} className="surface-card">
            <h2 className="text-xl font-semibold text-app">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{card.description}</p>
            <Link to={card.path} className="button-primary mt-6">
              Open {card.title}
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
