import { CheckCircle2, Lock } from 'lucide-react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import type { Chore } from '../../types'

interface ChoreCardProps {
  chore: Chore
  onComplete: (choreId: number) => void
  standardChoresDone: boolean
}

export function ChoreCard({ chore, onComplete, standardChoresDone }: ChoreCardProps) {
  const isLocked = chore.is_bonus && !standardChoresDone
  const canComplete = !chore.is_completed && !isLocked

  return (
    <motion.div
      whileHover={canComplete ? { y: -2 } : undefined}
      className={clsx(
        'bg-neu-base rounded-2xl p-5 flex flex-col justify-between h-44',
        chore.is_completed ? 'neu-inset opacity-60' : isLocked ? 'neu-flat opacity-40' : 'neu-raised'
      )}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <span className={clsx(
            'text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide',
            chore.is_bonus ? 'bg-accent-amber/15 text-accent-amber' : 'bg-accent-teal/15 text-accent-teal'
          )}>
            {chore.is_bonus ? 'Bonus' : chore.frequency}
          </span>
          {chore.is_bonus ? (
            <span className="font-bold text-accent-amber">£{chore.reward_money.toFixed(2)}</span>
          ) : (
            <span className="font-bold text-text-muted text-xs">Required</span>
          )}
        </div>
        <h3 className={clsx(
          'text-lg font-semibold',
          chore.is_completed ? 'text-text-muted line-through' : 'text-text-primary'
        )}>
          {chore.title}
        </h3>
      </div>

      <button
        onClick={() => canComplete && onComplete(chore.id)}
        disabled={!canComplete}
        className={clsx(
          'w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2',
          chore.is_completed
            ? 'neu-inset-sm text-accent-teal'
            : isLocked
              ? 'neu-flat text-text-muted cursor-not-allowed'
              : 'bg-accent-teal text-neu-base hover:bg-accent-teal/90 active:neu-inset-sm'
        )}
      >
        {chore.is_completed ? (
          <><CheckCircle2 className="h-4 w-4" /> Done</>
        ) : isLocked ? (
          <><Lock className="h-4 w-4" /> Locked</>
        ) : 'Mark Complete'}
      </button>
    </motion.div>
  )
}
