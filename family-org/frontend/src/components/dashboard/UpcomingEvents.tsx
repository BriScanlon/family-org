import { Calendar } from 'lucide-react'
import { NeuCard } from '../ui/NeuCard'
import type { Event } from '../../types'

interface UpcomingEventsProps {
  events: Event[]
  onViewAll: () => void
}

export function UpcomingEvents({ events, onViewAll }: UpcomingEventsProps) {
  return (
    <NeuCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent-blue" />
          Next Up
        </h2>
        <button
          onClick={onViewAll}
          className="text-xs text-accent-primary font-semibold hover:text-accent-primary-hover transition-colors"
        >
          View All
        </button>
      </div>

      {events.length > 0 ? (
        <div className="space-y-2">
          {events.slice(0, 3).map(event => (
            <div
              key={event.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-border-muted"
            >
              <div className="text-center min-w-[2.5rem]">
                <span className="block text-[10px] font-bold text-text-muted uppercase">
                  {new Date(event.start_time).toLocaleString('default', { month: 'short' })}
                </span>
                <span className="block text-lg font-bold text-text-primary leading-tight">
                  {new Date(event.start_time).getDate()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm truncate">{event.summary}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {event.location && ` · ${event.location}`}
                </p>
              </div>
              <span className="text-[10px] font-bold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full shrink-0">
                {event.user_name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center bg-surface-raised border border-border-muted">
          <Calendar className="h-6 w-6 text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm">No upcoming events</p>
        </div>
      )}
    </NeuCard>
  )
}
