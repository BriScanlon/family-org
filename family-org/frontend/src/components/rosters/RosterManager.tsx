import { useState, useEffect } from 'react'
import { Plus, Trash2, Users, ListChecks, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'react-toastify'
import { NeuCard } from '../ui/NeuCard'
import { NeuButton } from '../ui/NeuButton'
import { NeuInput } from '../ui/NeuInput'
import { NeuModal } from '../ui/NeuModal'
import type { Roster, FamilyMember } from '../../types'

interface RosterManagerProps {
  onUpdate: () => void
}

export function RosterManager({ onUpdate }: RosterManagerProps) {
  const [rosters, setRosters] = useState<Roster[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Create roster state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  // Add chore state
  const [addingChoreFor, setAddingChoreFor] = useState<number | null>(null)
  const [choreTitle, setChoreTitle] = useState('')
  const [chorePoints, setChorePoints] = useState(0)
  const [choreFrequency, setChoreFrequency] = useState('daily')

  // Assign state
  const [assigningFor, setAssigningFor] = useState<number | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<number[]>([])

  const fetchRosters = () => {
    Promise.all([
      fetch('/api/rosters/').then(r => r.json()),
      fetch('/api/rosters/family-members').then(r => r.json()),
    ]).then(([rostersData, membersData]) => {
      setRosters(rostersData)
      setMembers(membersData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchRosters() }, [])

  const handleCreateRoster = () => {
    if (!newName.trim()) return
    fetch('/api/rosters/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(() => { toast.success('Roster created!'); setNewName(''); setShowCreate(false); fetchRosters(); onUpdate() })
      .catch(err => toast.error(err.message))
  }

  const handleDeleteRoster = (id: number) => {
    if (!confirm('Delete this roster and all its chores?')) return
    fetch(`/api/rosters/${id}`, { method: 'DELETE' })
      .then(() => { toast.success('Roster deleted'); fetchRosters(); onUpdate() })
  }

  const handleAddChore = () => {
    if (!choreTitle.trim() || addingChoreFor === null) return
    fetch(`/api/rosters/${addingChoreFor}/chores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: choreTitle, points: chorePoints, frequency: choreFrequency })
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(() => {
        toast.success('Chore added to roster!')
        setChoreTitle(''); setChorePoints(0); setChoreFrequency('daily'); setAddingChoreFor(null)
        fetchRosters(); onUpdate()
      })
      .catch(err => toast.error(err.message))
  }

  const handleDeleteChore = (choreId: number) => {
    fetch(`/api/chores/${choreId}`, { method: 'DELETE' })
      .then(r => { if (!r.ok) throw new Error('Failed') })
      .then(() => { fetchRosters(); onUpdate() })
      .catch(err => toast.error(err.message))
  }

  const handleAssign = () => {
    if (assigningFor === null || selectedMembers.length === 0) return
    fetch(`/api/rosters/${assigningFor}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: selectedMembers })
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(() => {
        toast.success('Roster assigned!')
        setSelectedMembers([]); setAssigningFor(null)
        fetchRosters(); onUpdate()
      })
      .catch(err => toast.error(err.message))
  }

  const handleUnassign = (rosterId: number, userId: number) => {
    fetch(`/api/rosters/${rosterId}/assign/${userId}`, { method: 'DELETE' })
      .then(() => { fetchRosters(); onUpdate() })
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-text-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-3" />
        Loading rosters...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text-primary">Rosters</h2>
        <NeuButton variant="teal" onClick={() => setShowCreate(true)}>
          <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New Roster</span>
        </NeuButton>
      </div>

      {rosters.length === 0 && (
        <NeuCard>
          <p className="text-text-muted text-center py-8">
            No rosters yet. Create one to assign chores to your children.
          </p>
        </NeuCard>
      )}

      {rosters.map(roster => {
        const isExpanded = expandedId === roster.id
        return (
          <NeuCard key={roster.id}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setExpandedId(isExpanded ? null : roster.id)}
                className="flex items-center gap-3 text-left flex-1"
              >
                {isExpanded ? <ChevronDown className="h-5 w-5 text-text-muted" /> : <ChevronRight className="h-5 w-5 text-text-muted" />}
                <div>
                  <h3 className="text-lg font-bold text-text-primary">{roster.name}</h3>
                  <p className="text-xs text-text-muted">
                    {roster.chores.length} chores · {roster.assignments.length} assigned
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <NeuButton variant="ghost" size="sm" onClick={() => { setAssigningFor(roster.id); setSelectedMembers(roster.assignments.map(a => a.user_id)) }}>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Assign</span>
                </NeuButton>
                <NeuButton variant="ghost" size="sm" onClick={() => setAddingChoreFor(roster.id)}>
                  <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Chore</span>
                </NeuButton>
                <button onClick={() => handleDeleteRoster(roster.id)} className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted hover:text-accent-red transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-4">
                {/* Assigned members */}
                {roster.assignments.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Assigned to</p>
                    <div className="flex flex-wrap gap-2">
                      {roster.assignments.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-primary/10 text-accent-primary text-sm font-medium">
                          {a.user_name}
                          <button onClick={() => handleUnassign(roster.id, a.user_id)} className="hover:text-accent-red transition-colors">
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chores list */}
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Chores</p>
                  {roster.chores.length === 0 ? (
                    <p className="text-sm text-text-muted">No chores added yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {roster.chores.map(chore => (
                        <div key={chore.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-surface-raised">
                          <div className="flex items-center gap-3">
                            <ListChecks className="h-4 w-4 text-accent-primary" />
                            <span className="text-sm font-medium text-text-primary">{chore.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-surface-raised px-2 py-0.5 rounded">{chore.frequency}</span>
                            <span className="text-xs font-bold text-accent-primary">{chore.points} pts</span>
                            <button onClick={() => handleDeleteChore(chore.id)} className="p-1 hover:text-accent-red text-text-muted transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </NeuCard>
        )
      })}

      {/* Create Roster Modal */}
      <NeuModal open={showCreate} onClose={() => setShowCreate(false)} title="New Roster">
        <div className="space-y-4">
          <NeuInput label="Roster Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Weekday Chores" />
          <NeuButton variant="teal" className="w-full" onClick={handleCreateRoster}>Create Roster</NeuButton>
        </div>
      </NeuModal>

      {/* Add Chore Modal */}
      <NeuModal open={addingChoreFor !== null} onClose={() => setAddingChoreFor(null)} title="Add Chore to Roster">
        <div className="space-y-4">
          <NeuInput label="Chore Title" value={choreTitle} onChange={e => setChoreTitle(e.target.value)} placeholder="e.g. Make bed" />
          <NeuInput label="Points" type="number" value={chorePoints} onChange={e => setChorePoints(parseInt(e.target.value) || 0)} />
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Frequency</label>
            <select
              value={choreFrequency}
              onChange={e => setChoreFrequency(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-base border border-border-default text-text-primary outline-none focus:border-accent-primary"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <NeuButton variant="teal" className="w-full" onClick={handleAddChore}>Add Chore</NeuButton>
        </div>
      </NeuModal>

      {/* Assign Modal */}
      <NeuModal open={assigningFor !== null} onClose={() => setAssigningFor(null)} title="Assign Roster">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Select family members to assign this roster to:</p>
          <div className="space-y-2">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-border-default cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(m.id)}
                  onChange={e => {
                    if (e.target.checked) setSelectedMembers(prev => [...prev, m.id])
                    else setSelectedMembers(prev => prev.filter(id => id !== m.id))
                  }}
                  className="h-4 w-4 rounded accent-accent-primary"
                />
                <span className="text-sm font-medium text-text-primary">{m.name}</span>
              </label>
            ))}
          </div>
          <NeuButton variant="teal" className="w-full" onClick={handleAssign}>Save Assignments</NeuButton>
        </div>
      </NeuModal>
    </div>
  )
}
