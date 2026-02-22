import { Zap, Wallet, Settings, LogOut } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import type { User } from '../../types'

type Tab = 'dashboard' | 'calendar' | 'chores' | 'rewards' | 'settings'

interface NavbarProps {
  user: User
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function Navbar({ user, activeTab, onTabChange }: NavbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-neu-base neu-raised-sm border-b border-neu-dark/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => onTabChange('dashboard')}
            >
              <div className="bg-accent-teal text-neu-base p-1.5 rounded-lg">
                <Zap className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight text-text-primary">
                FamilyOrg
              </span>
            </div>

            <div className="hidden md:flex space-x-1">
              {(['dashboard', 'calendar', 'chores', 'rewards'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    activeTab === tab
                      ? 'neu-inset-sm text-accent-teal'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 neu-inset-sm px-3 py-1.5 rounded-full">
              <Wallet className="h-4 w-4 text-accent-amber" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                Balance
              </span>
              <span className="font-bold text-accent-amber">
                £{user.balance.toFixed(2)}
              </span>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-full transition-all hover:neu-raised-sm"
              >
                <div className="h-9 w-9 rounded-full bg-accent-teal text-neu-base flex items-center justify-center font-bold text-sm neu-raised-sm">
                  {user.name.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 mt-2 w-56 bg-neu-base neu-raised-lg rounded-xl py-1 z-50 origin-top-right"
                  >
                    <div className="px-4 py-3 border-b border-neu-light/50">
                      <p className="text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="text-xs text-text-muted truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { onTabChange('settings'); setShowUserMenu(false) }}
                      className="flex w-full items-center px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-neu-light/30"
                    >
                      <Settings className="mr-3 h-4 w-4 text-text-muted" />
                      Settings
                    </button>
                    <button
                      onClick={() => (window.location.href = '/api/auth/logout')}
                      className="flex w-full items-center px-4 py-2 text-sm text-accent-red hover:bg-accent-red/10"
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
