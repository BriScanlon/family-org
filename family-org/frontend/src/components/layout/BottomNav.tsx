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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-neu-base neu-raised-sm border-t border-neu-light/30">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all duration-200',
              activeTab === id
                ? 'text-accent-teal'
                : 'text-text-muted'
            )}
          >
            <div className={clsx(
              'p-1.5 rounded-lg transition-all duration-200',
              activeTab === id && 'neu-raised-sm'
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
