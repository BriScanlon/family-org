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
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="neu-raised-sm rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-accent-amber flex-shrink-0" />
                <p className="text-sm font-medium text-text-primary">{alert.message}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAlertFeedback(alert.id, 1)}
                  className="p-1.5 hover:bg-neu-light/30 rounded-lg text-text-muted hover:text-accent-teal transition-colors"
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onAlertFeedback(alert.id, -1)}
                  className="p-1.5 hover:bg-neu-light/30 rounded-lg text-text-muted hover:text-accent-red transition-colors"
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SummaryStrip chores={chores} events={events} user={user} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <ChoreChecklist chores={chores} onComplete={onCompleteChore} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <UpcomingEvents events={events} onViewAll={onViewCalendar} />
          <LeagueTable entries={leagueTable} currentUserId={user.id} />
        </div>
      </div>
    </div>
  )
}
