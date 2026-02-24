import { CheckSquare, Calendar, Wallet } from 'lucide-react'
import type { Chore, Event, User } from '../../types'

interface SummaryStripProps {
  chores: Chore[]
  events: Event[]
  user: User
}

export function SummaryStrip({ chores, events, user }: SummaryStripProps) {
  const remaining = chores.filter(c => !c.is_bonus && !c.is_completed).length
  const total = chores.filter(c => !c.is_bonus).length

  const todayEvents = events.filter(e => {
    const eventDate = new Date(e.start_time)
    const today = new Date()
    return eventDate.toDateString() === today.toDateString()
  })

  const stats = [
    {
      icon: CheckSquare,
      label: 'Chores done',
      value: `${total - remaining}/${total}`,
      accent: 'text-accent-primary',
      bg: 'bg-accent-primary/10',
    },
    {
      icon: Calendar,
      label: 'Events today',
      value: String(todayEvents.length),
      accent: 'text-accent-blue',
      bg: 'bg-accent-blue/10',
    },
    {
      icon: Wallet,
      label: 'Balance',
      value: `£${user.balance.toFixed(2)}`,
      accent: 'text-accent-amber',
      bg: 'bg-accent-amber/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map(({ icon: Icon, label, value, accent, bg }) => (
        <div
          key={label}
          className="bg-surface-card border border-border-default rounded-2xl p-4 flex items-center gap-4 card-shadow"
        >
          <div className={`p-2.5 rounded-xl ${bg}`}>
            <Icon className={`h-5 w-5 ${accent}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${accent}`}>{value}</p>
            <p className="text-xs text-text-muted font-medium">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
