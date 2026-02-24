import { SummaryStrip } from './SummaryStrip'
import { ChoreChecklist } from './ChoreChecklist'
import { UpcomingEvents } from './UpcomingEvents'
import { LeagueTable } from './LeagueTable'
import type { User, Chore, Event, LeagueEntry, Alert } from '../../types'
import { AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react'

interface DashboardProps {
  user: User
  chores: Chore[]
  events: Event[]
  leagueTable: LeagueEntry[]
  alerts: Alert[]
  onCompleteChore: (choreId: number) => void
  onAlertFeedback: (alertId: number, feedback: number) => void
  onViewCalendar: () => void
}

export function Dashboard({
  user, chores, events, leagueTable, alerts,
  onCompleteChore, onAlertFeedback, onViewCalendar
}: DashboardProps) {
  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AlertTriangle className="h-4 w-4 text-accent-amber flex-shrink-0" />
                <p className="text-sm text-text-primary truncate">{alert.message}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onAlertFeedback(alert.id, 1)}
                  className="p-1.5 hover:bg-accent-primary/10 rounded-lg text-text-muted hover:text-accent-primary transition-colors"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onAlertFeedback(alert.id, -1)}
                  className="p-1.5 hover:bg-accent-red/10 rounded-lg text-text-muted hover:text-accent-red transition-colors"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SummaryStrip chores={chores} events={events} user={user} />

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-4">
          <ChoreChecklist chores={chores} onComplete={onCompleteChore} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <UpcomingEvents events={events} onViewAll={onViewCalendar} />
          {leagueTable.length > 0 && (
            <LeagueTable entries={leagueTable} currentUserId={user.id} />
          )}
        </div>
      </div>
    </div>
  )
}
