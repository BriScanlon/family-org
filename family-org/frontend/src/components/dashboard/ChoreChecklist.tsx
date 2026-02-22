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

      <NeuProgress value={standardDone} max={standard.length} className="mb-6" />

      <div className="space-y-2">
        {standard.map(chore => (
          <button
            key={chore.id}
            onClick={() => !chore.is_completed && onComplete(chore.id)}
            disabled={chore.is_completed}
            className={clsx(
              'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left',
              chore.is_completed
                ? 'neu-inset-sm opacity-50'
                : 'neu-raised-sm hover:neu-raised active:neu-inset-sm'
            )}
          >
            <div className={clsx(
              'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              chore.is_completed
                ? 'bg-accent-teal border-accent-teal text-neu-base'
                : 'border-text-muted'
            )}>
              {chore.is_completed && <CheckCircle2 className="h-3.5 w-3.5" />}
            </div>
            <span className={clsx(
              'text-sm font-medium flex-1',
              chore.is_completed ? 'line-through text-text-muted' : 'text-text-primary'
            )}>
              {chore.title}
            </span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-neu-light/30 px-2 py-0.5 rounded">
              {chore.frequency}
            </span>
          </button>
        ))}
      </div>

      {bonus.length > 0 && (
        <div className="mt-6 pt-6 border-t border-neu-light/30">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-accent-amber" />
            <h3 className="text-base font-bold text-text-primary">Bonus Jobs</h3>
          </div>

          {!allStandardDone && (
            <div className="neu-inset-sm rounded-xl p-3 flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-accent-amber" />
              <p className="text-xs text-accent-amber font-medium">
                Complete all standard chores to unlock
              </p>
            </div>
          )}

          <div className="space-y-2">
            {bonus.map(chore => (
              <button
                key={chore.id}
                onClick={() => !chore.is_completed && allStandardDone && onComplete(chore.id)}
                disabled={chore.is_completed || !allStandardDone}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all duration-200 text-left',
                  chore.is_completed
                    ? 'neu-inset-sm opacity-50'
                    : !allStandardDone
                      ? 'neu-flat opacity-30 cursor-not-allowed'
                      : 'neu-raised-sm hover:neu-raised active:neu-inset-sm'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    chore.is_completed
                      ? 'bg-accent-teal border-accent-teal text-neu-base'
                      : 'border-text-muted'
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
