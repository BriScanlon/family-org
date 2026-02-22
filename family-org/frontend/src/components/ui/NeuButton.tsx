import clsx from 'clsx'

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'teal' | 'amber' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function NeuButton({ children, variant = 'teal', size = 'md', className, disabled, ...props }: NeuButtonProps) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        'font-semibold transition-all duration-200 rounded-xl',
        'active:neu-inset-sm',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variant === 'teal' && 'bg-accent-teal text-neu-base hover:bg-accent-teal/90',
        variant === 'amber' && 'bg-accent-amber text-neu-base hover:bg-accent-amber/90',
        variant === 'danger' && 'bg-accent-red text-neu-base hover:bg-accent-red/90',
        variant === 'ghost' && 'bg-transparent text-text-secondary hover:text-text-primary neu-raised-sm hover:neu-raised',
        disabled && 'opacity-40 cursor-not-allowed hover:opacity-40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
