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
        'font-semibold transition-all duration-150 rounded-xl inline-flex items-center justify-center',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variant === 'teal' && 'bg-accent-primary text-text-inverse hover:bg-accent-primary-hover active:scale-[0.97]',
        variant === 'amber' && 'bg-accent-amber text-text-inverse hover:bg-accent-amber-hover active:scale-[0.97]',
        variant === 'danger' && 'bg-accent-red text-white hover:bg-accent-red/90 active:scale-[0.97]',
        variant === 'ghost' && 'bg-surface-raised text-text-secondary border border-border-default hover:text-text-primary hover:border-border-accent hover:bg-surface-card',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
