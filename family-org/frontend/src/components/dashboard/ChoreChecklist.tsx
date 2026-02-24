import { CheckCircle2, Lock, Zap } from 'lucide-react'
import clsx from 'clsx'
import { NeuCard } from '../ui/NeuCard'
import { NeuProgress } from '../ui/NeuProgress'
import type { Chore } from '../../types'

interface ChoreChecklistProps {
  chores: Chore[]
  onComplete: (choreId: number) => void
}

export function ChoreChecklist({ chores, onComplete }: ChoreChecklistProps) {
  const standard = chores.filter(c => !c.is_bonus)
  const bonus = chores.filter(c => c.is_bonus)
  const standardDone = standard.filter(c => c.is_completed).length
  const allStandardDone = standard.every(c => c.is_completed)

  return (
    <NeuCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text-primary">Today's Chores</h2>
        <span className="text-sm font-bold text-text-muted">
          {standardDone}/{standard.length}
        </span>
      </div>

      <NeuProgress value={standardDone} max={standard.length} className="mb-5" />

      <div className="space-y-1.5">
        {standard.map(chore => (
          <button
            key={chore.id}
            onClick={() => !chore.is_completed && onComplete(chore.id)}
            disabled={chore.is_completed}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group',
              chore.is_completed
                ? 'opacity-50'
                : 'hover:bg-surface-raised active:scale-[0.99]'
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
        ))}
      </div>

      {bonus.length > 0 && (
        <div className="mt-5 pt-5 border-t border-border-default">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-accent-amber" />
            <h3 className="text-sm font-bold text-text-primary">Bonus Jobs</h3>
          </div>

          {!allStandardDone && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3 bg-accent-amber/5 border border-accent-amber/20">
              <Lock className="h-4 w-4 text-accent-amber" />
              <p className="text-xs text-accent-amber font-medium">
                Complete all standard chores to unlock
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {bonus.map(chore => (
              <button
                key={chore.id}
                onClick={() => !chore.is_completed && allStandardDone && onComplete(chore.id)}
                disabled={chore.is_completed || !allStandardDone}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left',
                  chore.is_completed
                    ? 'opacity-50'
                    : !allStandardDone
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
                  +£{chore.reward_money.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </NeuCard>
  )
}
