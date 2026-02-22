import { CheckSquare, Calendar, Wallet } from 'lucide-react'
import { NeuCard } from '../ui/NeuCard'
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <NeuCard className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-teal/10">
          <CheckSquare className="h-5 w-5 text-accent-teal" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{total - remaining}/{total}</p>
          <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Chores done</p>
        </div>
      </NeuCard>

      <NeuCard className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10">
          <Calendar className="h-5 w-5 text-accent-blue" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{todayEvents.length}</p>
          <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Events today</p>
        </div>
      </NeuCard>

      <NeuCard className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-amber/10">
          <Wallet className="h-5 w-5 text-accent-amber" />
        </div>
        <div>
          <p className="text-2xl font-bold text-accent-amber">£{user.balance.toFixed(2)}</p>
          <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Balance</p>
        </div>
      </NeuCard>
    </div>
  )
}
