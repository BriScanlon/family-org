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
        'rounded-2xl bg-neu-base p-6',
        variant === 'raised' && 'neu-raised',
        variant === 'inset' && 'neu-inset',
        variant === 'flat' && 'neu-flat',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </Tag>
  )
}
