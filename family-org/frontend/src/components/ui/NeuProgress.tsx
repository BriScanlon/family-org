import clsx from 'clsx'

interface NeuProgressProps {
  value: number
  max: number
  className?: string
  color?: 'teal' | 'amber'
}

export function NeuProgress({ value, max, className, color = 'teal' }: NeuProgressProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={clsx('neu-inset-sm rounded-full h-3 bg-neu-base overflow-hidden', className)}>
      <div
        className={clsx(
          'h-full rounded-full transition-all duration-500',
          color === 'teal' ? 'bg-accent-teal' : 'bg-accent-amber'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
