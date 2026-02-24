import clsx from 'clsx'

interface NeuCardProps {
  children: React.ReactNode
  className?: string
  variant?: 'raised' | 'inset' | 'flat'
  as?: React.ElementType
  onClick?: () => void
}

export function NeuCard({ children, className, variant = 'raised', as: Tag = 'div', onClick }: NeuCardProps) {
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        'rounded-2xl p-6 transition-all duration-200',
        variant === 'raised' && 'bg-surface-card border border-border-default card-shadow',
        variant === 'inset' && 'bg-surface-base border border-border-muted',
        variant === 'flat' && 'bg-transparent',
        onClick && 'cursor-pointer hover:card-shadow-hover',
        className
      )}
    >
      {children}
    </Tag>
  )
}
