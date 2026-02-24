import { Home, Calendar, CheckSquare, Gift, Settings } from 'lucide-react'
import clsx from 'clsx'

type Tab = 'dashboard' | 'calendar' | 'chores' | 'rewards' | 'settings'

interface BottomNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'chores', label: 'Chores', icon: CheckSquare },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-card/80 backdrop-blur-md border-t border-border-default">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 flex-1 py-2 relative transition-all duration-150',
              activeTab === id
                ? 'text-accent-primary'
                : 'text-text-muted'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {label}
            </span>
            {activeTab === id && (
              <div className="absolute bottom-1 w-6 h-0.5 rounded-full bg-accent-primary" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
