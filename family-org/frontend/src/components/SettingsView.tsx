import { useState, useEffect } from 'react'
import { Check, ShieldCheck, Calendar as CalendarIcon, Save } from 'lucide-react'
import { toast } from 'react-toastify'
import clsx from 'clsx'

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

interface SettingsViewProps {
  user: any;
  onUpdate: () => void;
}

export function SettingsView({ user, onUpdate }: SettingsViewProps) {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(user.synced_calendars || [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
        if (!res.ok) throw new Error("Failed to save settings")
        return res.json()
      })
      .then(() => {
        setSaving(false)
        toast.success("Calendar sync settings saved!")
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
        toast.success("You are now a Parent!")
        onUpdate()
      })
  }

  if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse">Loading Google Calendars...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-6 w-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-slate-900">Account Settings</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <p className="font-semibold text-slate-800">Current Role</p>
            <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mt-1">{user.role}</p>
          </div>
          {user.role !== 'parent' && (
            <button 
              onClick={becomeParent}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-slate-800 transition-colors"
            >
              Set as Parent (Dev)
            </button>
          )}
        </div>
      </div>

      {user.role === 'parent' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-6 w-6 text-primary-600" />
              <h2 className="text-2xl font-bold text-slate-900">Sync Calendars</h2>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-primary-700 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>

          <p className="text-slate-500 text-sm mb-6">
            Select which Google Calendars you want to include in the family-wide dashboard.
          </p>

          <div className="space-y-2">
            {calendars.map(cal => (
              <label 
                key={cal.id}
                className={clsx(
                  "flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer",
                  selectedIds.includes(cal.id)
                    ? "border-primary-500 bg-primary-50/30"
                    : "border-slate-100 hover:border-slate-200"
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
                    "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors",
                    selectedIds.includes(cal.id) ? "bg-primary-600 border-primary-600 text-white" : "border-slate-300"
                  )}>
                    {selectedIds.includes(cal.id) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="font-semibold text-slate-700">{cal.summary}</span>
                </div>
                {cal.primary && <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full uppercase">Primary</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
