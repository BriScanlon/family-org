import { useState, useEffect } from 'react'
import { Check, ShieldCheck, Calendar as CalendarIcon, Save, Sun, Moon, Trophy, GraduationCap } from 'lucide-react'
import { toast } from 'react-toastify'
import clsx from 'clsx'
import { NeuCard } from '../ui/NeuCard'
import { NeuButton } from '../ui/NeuButton'
import { useTheme } from '../../contexts/ThemeContext'
import type { User, GoogleCalendar } from '../../types'

interface SettingsViewProps {
  user: User
  onUpdate: () => void
}

export function SettingsView({ user, onUpdate }: SettingsViewProps) {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(user.synced_calendars || [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [g4sEmail, setG4sEmail] = useState('')
  const [g4sPassword, setG4sPassword] = useState('')
  const [g4sStatus, setG4sStatus] = useState<{
    connected: boolean; email: string | null; last_sync: string | null; error: string | null
  } | null>(null)
  const [g4sSaving, setG4sSaving] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    fetch('/api/settings/calendars')
      .then(res => res.json())
      .then(data => {
        setCalendars(data)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetch('/api/settings/go4schools/status')
      .then(res => res.json())
      .then(setG4sStatus)
      .catch(() => {})
  }, [])

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSave = () => {
    setSaving(true)
    fetch('/api/settings/calendars/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedIds)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save settings')
        return res.json()
      })
      .then(() => {
        setSaving(false)
        toast.success('Calendar sync settings saved!')
        onUpdate()
      })
      .catch(err => {
        setSaving(false)
        toast.error(err.message)
      })
  }

  const becomeParent = () => {
    fetch('/api/settings/role/parent', { method: 'POST' })
      .then(() => {
        toast.success('You are now a Parent!')
        onUpdate()
      })
  }

  const handleG4sConnect = () => {
    if (!g4sEmail || !g4sPassword) return
    setG4sSaving(true)
    fetch('/api/settings/go4schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: g4sEmail, password: g4sPassword })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to connect')
        toast.success('Go4Schools connected! Syncing homework...')
        setG4sPassword('')
        return fetch('/api/settings/go4schools/status').then(r => r.json())
      })
      .then(status => { setG4sStatus(status); setG4sSaving(false); onUpdate() })
      .catch(err => { toast.error(err.message); setG4sSaving(false) })
  }

  const handleG4sDisconnect = () => {
    fetch('/api/settings/go4schools', { method: 'DELETE' })
      .then(() => {
        toast.success('Go4Schools disconnected')
        setG4sStatus({ connected: false, email: null, last_sync: null, error: null })
        setG4sEmail('')
        onUpdate()
      })
  }

  const handleG4sSync = () => {
    fetch('/api/settings/go4schools/sync', { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Sync failed')
        toast.info('Homework sync started...')
      })
      .catch(err => toast.error(err.message))
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-text-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-teal mx-auto mb-3"></div>
        Loading settings...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <NeuCard>
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-6 w-6 text-accent-teal" />
          <h2 className="text-2xl font-bold text-text-primary">Account Settings</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl neu-inset-sm">
          <div>
            <p className="font-semibold text-text-primary">Current Role</p>
            <p className="text-sm text-text-muted uppercase tracking-widest font-bold mt-1">{user.role}</p>
          </div>
          {user.role !== 'parent' && (
            <NeuButton variant="ghost" size="sm" onClick={becomeParent}>
              Set as Parent
            </NeuButton>
          )}
        </div>
      </NeuCard>

      <NeuCard>
        <div className="flex items-center gap-3 mb-6">
          {theme === 'dark' ? <Moon className="h-6 w-6 text-accent-teal" /> : <Sun className="h-6 w-6 text-accent-teal" />}
          <h2 className="text-2xl font-bold text-text-primary">Appearance</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl neu-inset-sm">
          <div>
            <p className="font-semibold text-text-primary">Theme</p>
            <p className="text-sm text-text-muted mt-1">
              {theme === 'dark' ? 'Dark mode is active' : 'Light mode is active'}
            </p>
          </div>
          <NeuButton variant="ghost" size="sm" onClick={toggleTheme}>
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </NeuButton>
        </div>
      </NeuCard>

      <NeuCard>
        <div className="flex items-center gap-3 mb-6">
          <GraduationCap className="h-6 w-6 text-accent-teal" />
          <h2 className="text-2xl font-bold text-text-primary">Go4Schools</h2>
        </div>

        {g4sStatus?.connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl neu-inset-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-text-primary">{g4sStatus.email}</p>
                  <p className="text-sm text-text-muted mt-1">
                    {g4sStatus.last_sync
                      ? `Last synced: ${new Date(g4sStatus.last_sync).toLocaleString()}`
                      : 'Sync pending...'}
                  </p>
                  {g4sStatus.error && (
                    <p className="text-sm text-accent-red mt-1">{g4sStatus.error}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <NeuButton variant="ghost" size="sm" onClick={handleG4sSync}>
                    Sync Now
                  </NeuButton>
                  <NeuButton variant="ghost" size="sm" onClick={handleG4sDisconnect}>
                    Disconnect
                  </NeuButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-text-muted text-sm">
              Connect your Go4Schools account to automatically sync homework as chores.
            </p>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Go4Schools email"
                value={g4sEmail}
                onChange={e => setG4sEmail(e.target.value)}
                className="w-full p-3 rounded-xl neu-inset-sm bg-transparent text-text-primary placeholder:text-text-muted/50 outline-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={g4sPassword}
                onChange={e => setG4sPassword(e.target.value)}
                className="w-full p-3 rounded-xl neu-inset-sm bg-transparent text-text-primary placeholder:text-text-muted/50 outline-none"
              />
            </div>
            <NeuButton variant="teal" onClick={handleG4sConnect} disabled={g4sSaving || !g4sEmail || !g4sPassword}>
              {g4sSaving ? 'Connecting...' : 'Connect'}
            </NeuButton>
          </div>
        )}
      </NeuCard>

      {user.role === 'parent' && (
        <NeuCard>
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-6 w-6 text-accent-teal" />
            <h2 className="text-2xl font-bold text-text-primary">Family Dashboard</h2>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl neu-inset-sm">
            <div>
              <p className="font-semibold text-text-primary">Family Standings</p>
              <p className="text-sm text-text-muted mt-1">
                {user.preferences?.show_league_table !== false ? 'Leaderboard is visible to everyone' : 'Leaderboard is hidden'}
              </p>
            </div>
            <NeuButton variant="ghost" size="sm" onClick={() => {
              const current = user.preferences?.show_league_table !== false
              fetch('/api/settings/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show_league_table: !current })
              }).then(res => {
                if (!res.ok) throw new Error('Failed to update')
                toast.success(current ? 'Leaderboard hidden' : 'Leaderboard visible')
                onUpdate()
              }).catch(err => toast.error(err.message))
            }}>
              {user.preferences?.show_league_table !== false ? 'Hide' : 'Show'}
            </NeuButton>
          </div>
        </NeuCard>
      )}

      {user.role === 'parent' && (
        <NeuCard>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-6 w-6 text-accent-teal" />
              <h2 className="text-2xl font-bold text-text-primary">Sync Calendars</h2>
            </div>
            <NeuButton variant="teal" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" /> Save Changes
                </span>
              )}
            </NeuButton>
          </div>

          <p className="text-text-muted text-sm mb-6">
            Select which Google Calendars to include in the family dashboard.
          </p>

          <div className="space-y-2">
            {calendars.map(cal => (
              <label
                key={cal.id}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer',
                  selectedIds.includes(cal.id)
                    ? 'neu-raised-sm'
                    : 'neu-flat hover:bg-neu-light/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selectedIds.includes(cal.id)}
                    onChange={() => handleToggle(cal.id)}
                  />
                  <div className={clsx(
                    'h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors',
                    selectedIds.includes(cal.id) ? 'bg-accent-teal border-accent-teal text-neu-base' : 'border-text-muted'
                  )}>
                    {selectedIds.includes(cal.id) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="font-semibold text-text-primary">{cal.summary}</span>
                </div>
                {cal.primary && (
                  <span className="text-[10px] font-bold text-accent-teal bg-accent-teal/15 px-2 py-0.5 rounded-full uppercase">
                    Primary
                  </span>
                )}
              </label>
            ))}
          </div>
        </NeuCard>
      )}
    </div>
  )
}
