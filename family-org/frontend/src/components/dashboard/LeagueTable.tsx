import { Trophy } from 'lucide-react'
import clsx from 'clsx'
import { NeuCard } from '../ui/NeuCard'
import type { LeagueEntry } from '../../types'

interface LeagueTableProps {
  entries: LeagueEntry[]
  currentUserId: number
}

export function LeagueTable({ entries, currentUserId }: LeagueTableProps) {
  return (
    <NeuCard>
      <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-accent-amber" />
        Family Standings
      </h2>

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={entry.user_id}
            className={clsx(
              'flex items-center gap-3 p-3 rounded-xl',
              entry.user_id === currentUserId ? 'neu-raised-sm' : 'neu-flat'
            )}
          >
            <div className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs',
              index === 0 && 'bg-accent-amber/20 text-accent-amber',
              index === 1 && 'bg-text-muted/20 text-text-secondary',
              index === 2 && 'bg-accent-amber/10 text-accent-amber/70',
              index > 2 && 'text-text-muted'
            )}>
              {index + 1}
            </div>
            <span className="font-semibold text-text-primary flex-1">{entry.name}</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-text-muted">
                <span className="font-bold text-text-secondary">{entry.standard_completed}</span> jobs
              </span>
              <span className="text-text-muted">
                <span className="font-bold text-accent-amber">{entry.bonus_completed}</span> bonus
              </span>
              <span className="font-bold text-accent-teal">{entry.total_points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </NeuCard>
  )
}
