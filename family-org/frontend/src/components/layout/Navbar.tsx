import { Zap, Wallet, Settings, LogOut, Sun, Moon } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { useTheme } from '../../contexts/ThemeContext'
import type { User } from '../../types'

type Tab = 'dashboard' | 'calendar' | 'chores' | 'rewards' | 'settings'

interface NavbarProps {
  user: User
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function Navbar({ user, activeTab, onTabChange }: NavbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="sticky top-0 z-50 bg-surface-card/80 backdrop-blur-md border-b border-border-default">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => onTabChange('dashboard')}
            >
              <div className="bg-accent-primary text-text-inverse p-1.5 rounded-lg">
                <Zap className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-text-primary">
                Scanlon Plan
              </span>
            </div>

            <div className="hidden md:flex items-center bg-surface-base rounded-xl p-1">
              {(['dashboard', 'calendar', 'chores', 'rewards'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={clsx(
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                    activeTab === tab
                      ? 'bg-surface-card text-accent-primary card-shadow'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-base rounded-xl px-3 py-1.5 border border-border-muted">
              <Wallet className="h-4 w-4 text-accent-amber" />
              <span className="font-bold text-accent-amber text-sm">
                £{user.balance.toFixed(2)}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-raised transition-all"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-full transition-all hover:ring-2 hover:ring-accent-primary/30"
              >
                <div className="h-9 w-9 rounded-full bg-accent-primary text-text-inverse flex items-center justify-center font-bold text-sm">
                  {user.name.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 mt-2 w-56 bg-surface-card border border-border-default card-shadow-lg rounded-xl overflow-hidden z-50 origin-top-right"
                  >
                    <div className="px-4 py-3 border-b border-border-default">
                      <p className="text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="text-xs text-text-muted truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { onTabChange('settings'); setShowUserMenu(false) }}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                    >
                      <Settings className="mr-3 h-4 w-4 text-text-muted" />
                      Settings
                    </button>
                    <button
                      onClick={() => (window.location.href = '/api/auth/logout')}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-accent-red hover:bg-accent-red/10 transition-colors"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
