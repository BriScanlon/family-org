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
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Calendar className="h-5 w-5 text-accent-blue" />
          Next Up
        </h2>
        <button
          onClick={onViewAll}
          className="text-sm text-accent-teal font-medium hover:underline"
        >
          View All
        </button>
      </div>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.slice(0, 3).map(event => (
            <div
              key={event.id}
              className="flex items-center gap-4 p-3 rounded-xl neu-raised-sm"
            >
              <div className="neu-inset-sm p-2 rounded-lg text-center min-w-[3rem]">
                <span className="block text-[10px] font-bold text-text-muted uppercase">
                  {new Date(event.start_time).toLocaleString('default', { month: 'short' })}
                </span>
                <span className="block text-lg font-bold text-text-primary">
                  {new Date(event.start_time).getDate()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary truncate">{event.summary}</p>
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
        <div className="neu-inset rounded-xl p-8 text-center">
          <Calendar className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm font-medium">No upcoming events</p>
        </div>
      )}
    </NeuCard>
  )
}
