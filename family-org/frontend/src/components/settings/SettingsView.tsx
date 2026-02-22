import { useState, useEffect } from 'react'
import { Check, ShieldCheck, Calendar as CalendarIcon, Save, Sun, Moon } from 'lucide-react'
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
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    fetch('/api/settings/calendars')
      .then(res => res.json())
      .then(data => {
        setCalendars(data)
        setLoading(false)
      })
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
