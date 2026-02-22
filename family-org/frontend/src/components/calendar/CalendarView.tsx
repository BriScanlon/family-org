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
    <div className="bg-neu-base neu-raised rounded-2xl overflow-hidden flex flex-col min-h-[800px]">
      <div className="p-6 border-b border-neu-light/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-text-primary">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex neu-inset-sm p-1 rounded-lg">
            <button
              onClick={() => setView('week')}
              className={clsx(
                'px-3 py-1 text-sm font-medium rounded-md transition-all',
                view === 'week' ? 'neu-raised-sm text-accent-teal' : 'text-text-muted'
              )}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={clsx(
                'px-3 py-1 text-sm font-medium rounded-md transition-all',
                view === 'month' ? 'neu-raised-sm text-accent-teal' : 'text-text-muted'
              )}
            >
              Month
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-neu-light/30 rounded-full transition-colors text-text-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm font-medium text-text-secondary hover:bg-neu-light/30 rounded-md"
          >
            Today
          </button>
          <button
            onClick={() => navigate('next')}
            className="p-2 hover:bg-neu-light/30 rounded-full transition-colors text-text-secondary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {view === 'week' ? (
          <div className="grid grid-cols-7 gap-4 h-full">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day)
              return (
                <div key={day.toString()} className="flex flex-col min-w-[120px]">
                  <div className={clsx(
                    'text-center py-2 mb-4 rounded-xl',
                    isSameDay(day, new Date()) ? 'neu-raised-sm text-accent-teal' : 'text-text-muted'
                  )}>
                    <span className="block text-xs font-bold uppercase tracking-wider">{format(day, 'EEE')}</span>
                    <span className="text-xl font-bold">{format(day, 'd')}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {dayEvents.map(event => (
                      <div key={event.id} className="p-2 rounded-lg neu-raised-sm text-xs">
                        <p className="font-bold text-text-primary line-clamp-2">{event.summary}</p>
                        <p className="text-text-muted mt-1">{format(new Date(event.start_time), 'HH:mm')}</p>
                        <span className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-accent-teal/15 text-accent-teal font-bold text-[10px]">
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
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 border-b border-neu-light/30 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="py-2 text-center text-xs font-bold text-text-muted uppercase tracking-widest">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-5 gap-px bg-neu-light/20 flex-1 border border-neu-light/30 rounded-xl overflow-hidden">
              {monthDays.map((day) => {
                const dayEvents = getEventsForDay(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={day.toString()}
                    className={clsx(
                      'bg-neu-base p-2 min-h-[100px] flex flex-col',
                      !isCurrentMonth && 'opacity-40'
                    )}
                  >
                    <div className="flex justify-end mb-1">
                      <span className={clsx(
                        'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full',
                        isToday ? 'bg-accent-teal text-neu-base' : isCurrentMonth ? 'text-text-secondary' : 'text-text-muted'
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className="px-1.5 py-0.5 rounded-md bg-accent-teal/15 text-[10px] text-accent-teal font-medium truncate"
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
