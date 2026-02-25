import { CheckCircle2, Lock, Pencil, Trash2, Undo2 } from 'lucide-react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import type { Chore } from '../../types'

interface ChoreCardProps {
  chore: Chore
  onComplete: (choreId: number) => void
  standardChoresDone: boolean
  onEdit?: (chore: Chore) => void
  onDelete?: (choreId: number) => void
  onUncomplete?: (choreId: number) => void
  isParent?: boolean
}

export function ChoreCard({ chore, onComplete, standardChoresDone, onEdit, onDelete, onUncomplete, isParent }: ChoreCardProps) {
  const isLocked = chore.is_bonus && !standardChoresDone
  const canComplete = !chore.is_completed && !isLocked

  return (
    <motion.div
      whileHover={canComplete ? { y: -2 } : undefined}
      className={clsx(
        'bg-surface-card border rounded-2xl p-5 flex flex-col justify-between h-44 transition-all duration-150',
        chore.is_completed
          ? 'border-border-muted opacity-60'
          : isLocked
            ? 'border-border-muted opacity-40'
            : 'border-border-default card-shadow hover:card-shadow-hover'
      )}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <span className={clsx(
            'text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide',
            chore.is_bonus ? 'bg-accent-amber/15 text-accent-amber' : 'bg-accent-primary/10 text-accent-primary'
          )}>
            {chore.is_bonus ? 'Bonus' : chore.frequency}
          </span>
          <div className="flex items-center gap-2">
            {isParent && chore.source !== 'go4schools' && (
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit?.(chore)}
                  className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted hover:text-accent-primary transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this chore?')) onDelete?.(chore.id) }}
                  className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted hover:text-accent-red transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {chore.is_bonus ? (
              <span className="font-bold text-accent-amber">£{chore.reward_money.toFixed(2)}</span>
            ) : (
              <span className="font-bold text-text-muted text-xs">Required</span>
            )}
          </div>
        </div>
        <h3 className={clsx(
          'text-lg font-semibold flex items-center gap-2',
          chore.is_completed ? 'text-text-muted line-through' : 'text-text-primary'
        )}>
          {chore.title}
          {chore.source === 'go4schools' && (
            <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full uppercase">
              Homework
            </span>
          )}
        </h3>
        {chore.due_date && (
          <span className="text-xs text-text-muted">
            Due: {new Date(chore.due_date).toLocaleDateString()}
          </span>
        )}
      </div>

      {chore.is_completed ? (
        <div className="flex gap-2">
          <span className="flex-1 py-2 rounded-xl text-sm font-semibold bg-accent-primary/10 text-accent-primary flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Done
          </span>
          {isParent && (
            <button
              onClick={() => onUncomplete?.(chore.id)}
              className="px-3 py-2 rounded-xl text-sm font-semibold border border-border-default text-text-muted hover:text-accent-amber hover:border-accent-amber transition-colors flex items-center gap-1"
            >
              <Undo2 className="h-4 w-4" /> Undo
            </button>
          )}
        </div>
      ) : isLocked ? (
        <button disabled className="w-full py-2 rounded-xl text-sm font-semibold bg-surface-raised text-text-muted cursor-not-allowed flex items-center justify-center gap-2 border border-border-muted">
          <Lock className="h-4 w-4" /> Locked
        </button>
      ) : (
        <button
          onClick={() => onComplete(chore.id)}
          className="w-full py-2 rounded-xl text-sm font-semibold bg-accent-primary text-text-inverse hover:bg-accent-primary-hover active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2"
        >
          Mark Complete
        </button>
      )}
    </motion.div>
  )
}
