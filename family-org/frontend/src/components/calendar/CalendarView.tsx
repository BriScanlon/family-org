import { useState, useMemo } from 'react'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { Event } from '../../types'

interface CalendarViewProps {
  events: Event[]
}

export function CalendarView({ events }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.start_time), day))
  }

  const navigate = (direction: 'prev' | 'next') => {
    if (view === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    }
  }

  return (
    <div className="bg-surface-card border border-border-default card-shadow rounded-2xl overflow-hidden flex flex-col min-h-[800px]">
      <div className="p-4 sm:p-6 border-b border-border-default flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-text-primary">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex bg-surface-base rounded-lg p-1 border border-border-muted">
            <button
              onClick={() => setView('week')}
              className={clsx(
                'px-3 py-1 text-sm font-medium rounded-md transition-all',
                view === 'week' ? 'bg-surface-card text-accent-primary card-shadow' : 'text-text-muted hover:text-text-primary'
              )}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={clsx(
                'px-3 py-1 text-sm font-medium rounded-md transition-all',
                view === 'month' ? 'bg-surface-card text-accent-primary card-shadow' : 'text-text-muted hover:text-text-primary'
              )}
            >
              Month
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-surface-raised rounded-lg transition-colors text-text-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm font-medium text-text-secondary hover:bg-surface-raised rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigate('next')}
            className="p-2 hover:bg-surface-raised rounded-lg transition-colors text-text-secondary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {view === 'week' ? (
          <div className="grid grid-cols-7 gap-4 h-full min-w-[840px]">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day)
              return (
                <div key={day.toString()} className="flex flex-col min-w-[120px]">
                  <div className={clsx(
                    'text-center py-2 mb-4 rounded-xl',
                    isSameDay(day, new Date())
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'text-text-muted'
                  )}>
                    <span className="block text-xs font-bold uppercase tracking-wider">{format(day, 'EEE')}</span>
                    <span className="text-xl font-bold">{format(day, 'd')}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {dayEvents.map(event => (
                      <div key={event.id} className="p-2 rounded-lg bg-surface-raised border border-border-muted text-xs">
                        <p className="font-bold text-text-primary line-clamp-2">{event.summary}</p>
                        <p className="text-text-muted mt-1">{format(new Date(event.start_time), 'HH:mm')}</p>
                        <span className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary font-bold text-[10px]">
                          {event.user_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col h-full min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-border-default mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="py-2 text-center text-xs font-bold text-text-muted uppercase tracking-widest">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border-default flex-1 border border-border-default rounded-xl overflow-hidden" style={{ gridAutoRows: '1fr' }}>
              {monthDays.map((day) => {
                const dayEvents = getEventsForDay(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={day.toString()}
                    className={clsx(
                      'bg-surface-card p-2 min-h-[100px] flex flex-col',
                      !isCurrentMonth && 'opacity-40 bg-surface-base'
                    )}
                  >
                    <div className="flex justify-end mb-1">
                      <span className={clsx(
                        'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full',
                        isToday ? 'bg-accent-primary text-text-inverse' : isCurrentMonth ? 'text-text-secondary' : 'text-text-muted'
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className="px-1.5 py-0.5 rounded-md bg-accent-primary/10 text-[10px] text-accent-primary font-medium truncate"
                          title={`${event.summary} (${event.user_name})`}
                        >
                          {event.summary}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
