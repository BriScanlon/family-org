import { Activity, Bike, Footprints, Dumbbell } from 'lucide-react'
import { NeuCard } from '../ui/NeuCard'
import type { UserActivities } from '../../types'

interface RecentActivitiesProps {
  activities: UserActivities[]
}

const activityIcon = (type: string) => {
  switch (type) {
    case 'running': return Activity
    case 'cycling': return Bike
    case 'walking': case 'hiking': return Footprints
    default: return Dumbbell
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDistance(meters: number | null): string | null {
  if (!meters) return null
  return `${(meters / 1000).toFixed(1)} km`
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  const allActivities = activities.flatMap(u =>
    u.activities.map(a => ({ ...a, user_name: u.user_name, color: u.color }))
  ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 5)

  if (allActivities.length === 0) return null

  return (
    <NeuCard>
      <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-accent-primary" />
        Recent Activities
      </h2>

      <div className="space-y-2">
        {allActivities.map(act => {
          const Icon = activityIcon(act.activity_type)
          const dist = formatDistance(act.distance_meters)
          return (
            <div
              key={act.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-border-muted"
            >
              <div className="p-2 rounded-lg bg-accent-primary/10">
                <Icon className="h-4 w-4 text-accent-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm truncate">{act.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatDuration(act.duration_seconds)}
                  {dist && ` · ${dist}`}
                  {act.calories && ` · ${act.calories} cal`}
                </p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${act.color}20`, color: act.color }}
              >
                {act.user_name.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>
    </NeuCard>
  )
}
