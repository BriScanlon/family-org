import { useState, useEffect } from 'react'
import { CheckCircle2, Lock, Zap } from 'lucide-react'
import clsx from 'clsx'
import { NeuCard } from '../ui/NeuCard'
import { NeuProgress } from '../ui/NeuProgress'
import type { MyChoresResponse, FamilyChildOverview } from '../../types'

interface ChoreChecklistProps {
  onComplete: (choreId: number) => void
  userColor?: string
  isParent?: boolean
}

function ChoreRow({ chore, onComplete, disabled }: {
  chore: { id: number; title: string; points: number; frequency: string; is_completed: boolean }
  onComplete: (id: number) => void
  disabled?: boolean
}) {
  const isDisabled = chore.is_completed || disabled
  return (
    <button
      onClick={() => !isDisabled && onComplete(chore.id)}
      disabled={isDisabled}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group',
        chore.is_completed ? 'opacity-50' : disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-raised active:scale-[0.99]'
      )}
    >
      <div className={clsx(
        'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        chore.is_completed
          ? 'bg-accent-primary border-accent-primary text-text-inverse'
          : 'border-border-default group-hover:border-accent-primary'
      )}>
        {chore.is_completed && <CheckCircle2 className="h-3.5 w-3.5" />}
      </div>
      <span className={clsx(
        'text-sm font-medium flex-1',
        chore.is_completed ? 'line-through text-text-muted' : 'text-text-primary'
      )}>
        {chore.title}
      </span>
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider bg-surface-raised px-2 py-0.5 rounded">
        {chore.frequency}
      </span>
    </button>
  )
}

export function ChoreChecklist({ onComplete, userColor, isParent }: ChoreChecklistProps) {
  const [data, setData] = useState<MyChoresResponse | null>(null)
  const [familyData, setFamilyData] = useState<FamilyChildOverview[] | null>(null)

  const fetchMyChores = () => {
    fetch('/api/rosters/my-chores')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
  }

  const fetchFamilyOverview = () => {
    fetch('/api/rosters/family-overview')
      .then(r => r.ok ? r.json() : null)
      .then(setFamilyData)
      .catch(() => {})
  }

  useEffect(() => {
    fetchMyChores()
    if (isParent) fetchFamilyOverview()
  }, [isParent])

  const handleComplete = (choreId: number) => {
    onComplete(choreId)
    setTimeout(() => {
      fetchMyChores()
      if (isParent) fetchFamilyOverview()
    }, 500)
  }

  if (!data) {
    return (
      <NeuCard>
        <p className="text-text-muted text-center py-8">Loading chores...</p>
      </NeuCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Parent family overview */}
      {isParent && familyData && familyData.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Family Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {familyData.map(child => {
              const totalChores = child.rosters.reduce((s, r) => s + r.total, 0)
              const totalDone = child.rosters.reduce((s, r) => s + r.completed, 0)
              return (
                <div
                  key={child.user_id}
                  className="rounded-2xl overflow-hidden"
                  style={child.color ? { borderTop: `3px solid ${child.color}` } : undefined}
                >
                  <NeuCard className={child.color ? '!rounded-t-none' : undefined}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-bold text-text-primary">{child.user_name}</h3>
                      <span className={clsx(
                        'text-sm font-bold',
                        totalDone === totalChores && totalChores > 0 ? 'text-accent-primary' : 'text-text-muted'
                      )}>
                        {totalDone}/{totalChores}
                      </span>
                    </div>
                    <NeuProgress value={totalDone} max={totalChores} className="mb-3" />
                    {child.rosters.map(roster => (
                      <div key={roster.roster_id} className="space-y-1">
                        {roster.chores.map(chore => (
                          <div key={chore.id} className={clsx(
                            'flex items-center gap-3 px-3 py-2 rounded-xl text-left',
                            chore.is_completed ? 'opacity-50' : ''
                          )}>
                            <div className={clsx(
                              'h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                              chore.is_completed
                                ? 'bg-accent-primary border-accent-primary text-text-inverse'
                                : 'border-border-default'
                            )}>
                              {chore.is_completed && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                            <span className={clsx(
                              'text-sm font-medium flex-1',
                              chore.is_completed ? 'line-through text-text-muted' : 'text-text-primary'
                            )}>
                              {chore.title}
                            </span>
                            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                              {chore.frequency}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {totalChores === 0 && (
                      <p className="text-xs text-text-muted text-center py-2">No chores assigned</p>
                    )}
                  </NeuCard>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Roster cards (own chores for children) */}
      {data.rosters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.rosters.map(roster => (
            <div
              key={roster.roster_id}
              className="rounded-2xl overflow-hidden"
              style={userColor ? { borderTop: `3px solid ${userColor}` } : undefined}
            >
              <NeuCard className="!rounded-t-none">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-text-primary">{roster.roster_name}</h3>
                  <span className={clsx(
                    'text-sm font-bold',
                    roster.completed === roster.total ? 'text-accent-primary' : 'text-text-muted'
                  )}>
                    {roster.completed}/{roster.total}
                  </span>
                </div>
                <NeuProgress value={roster.completed} max={roster.total} className="mb-3" />
                <div className="space-y-1">
                  {roster.chores.map(chore => (
                    <ChoreRow key={chore.id} chore={chore} onComplete={handleComplete} />
                  ))}
                </div>
              </NeuCard>
            </div>
          ))}
        </div>
      )}

      {/* Remaining unassigned chores */}
      {data.unassigned.length > 0 && (
        <NeuCard>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">
            Other Tasks
          </h3>
          <div className="divide-y divide-border-muted">
            {data.unassigned.map(chore => (
              <div key={chore.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <button
                  onClick={() => !chore.is_completed && handleComplete(chore.id)}
                  disabled={chore.is_completed}
                  className={clsx(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    chore.is_completed
                      ? 'bg-accent-primary border-accent-primary text-text-inverse'
                      : 'border-border-default hover:border-accent-primary cursor-pointer'
                  )}
                >
                  {chore.is_completed && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
                <span className={clsx(
                  'text-sm font-medium flex-1',
                  chore.is_completed ? 'line-through text-text-muted' : 'text-text-primary'
                )}>
                  {chore.title}
                </span>
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {chore.frequency}
                </span>
                <span className="text-xs font-bold text-accent-primary">
                  {chore.points} pts
                </span>
              </div>
            ))}
          </div>
        </NeuCard>
      )}

      {/* Bonus section */}
      {data.bonus_chores.length > 0 && (
        <NeuCard>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-accent-amber" />
            <h3 className="text-sm font-bold text-text-primary">Bonus Jobs</h3>
          </div>

          {!data.bonus_unlocked && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3 bg-accent-amber/5 border border-accent-amber/20">
              <Lock className="h-4 w-4 text-accent-amber" />
              <p className="text-xs text-accent-amber font-medium">
                Complete all your chores to unlock
              </p>
            </div>
          )}

          <div className="space-y-1">
            {data.bonus_chores.map(chore => (
              <button
                key={chore.id}
                onClick={() => !chore.is_completed && data.bonus_unlocked && handleComplete(chore.id)}
                disabled={chore.is_completed || !data.bonus_unlocked}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left',
                  chore.is_completed
                    ? 'opacity-50'
                    : !data.bonus_unlocked
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-surface-raised active:scale-[0.99]'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    chore.is_completed
                      ? 'bg-accent-primary border-accent-primary text-text-inverse'
                      : 'border-border-default'
                  )}>
                    {chore.is_completed && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </div>
                  <span className={clsx(
                    'text-sm font-medium',
                    chore.is_completed ? 'line-through text-text-muted' : 'text-text-primary'
                  )}>
                    {chore.title}
                  </span>
                </div>
                <span className={clsx(
                  'text-xs font-bold',
                  chore.is_completed ? 'text-text-muted' : 'text-accent-amber'
                )}>
                  +£{(chore.points || 0).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </NeuCard>
      )}
    </div>
  )
}
