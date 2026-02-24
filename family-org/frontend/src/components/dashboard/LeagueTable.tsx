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
      <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-accent-amber" />
        Family Standings
      </h2>

      <div className="space-y-1">
        {entries.map((entry, index) => (
          <div
            key={entry.user_id}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
              entry.user_id === currentUserId && 'bg-surface-raised border border-border-muted'
            )}
          >
            <div className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs',
              index === 0 && 'bg-accent-amber/15 text-accent-amber',
              index === 1 && 'bg-text-muted/15 text-text-secondary',
              index === 2 && 'bg-accent-amber/10 text-accent-amber/70',
              index > 2 && 'text-text-muted'
            )}>
              {index + 1}
            </div>
            <span className="font-semibold text-text-primary text-sm flex-1">{entry.name}</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-text-muted">
                <span className="font-bold text-text-secondary">{entry.standard_completed}</span> jobs
              </span>
              <span className="font-bold text-accent-primary">{entry.total_points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </NeuCard>
  )
}
