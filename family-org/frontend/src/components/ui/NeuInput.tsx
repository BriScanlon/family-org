import clsx from 'clsx'
import { forwardRef } from 'react'

interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full px-4 py-2.5 rounded-xl bg-surface-base border border-border-default',
            'text-text-primary placeholder:text-text-muted',
            'outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30',
            'transition-all duration-150',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
NeuInput.displayName = 'NeuInput'
