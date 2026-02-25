import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'react-toastify'
import { NeuCard } from '../ui/NeuCard'
import { NeuButton } from '../ui/NeuButton'
import { NeuInput } from '../ui/NeuInput'
import { NeuModal } from '../ui/NeuModal'
import type { Roster, RosterChore, FamilyMember, Chore } from '../../types'

interface RosterManagerProps {
  onUpdate: () => void
}

/* ------------------------------------------------------------------ */
/*  Draggable chore chip                                              */
/* ------------------------------------------------------------------ */

function DraggableChore({ chore, source }: { chore: RosterChore | Chore; source: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${source}::${chore.id}`,
    data: { chore, source },
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-raised border border-border-default text-sm font-medium text-text-primary cursor-grab active:cursor-grabbing select-none transition-opacity ${isDragging ? 'opacity-30' : ''}`}
    >
      <GripVertical className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
      <span className="flex-1 truncate">{chore.title}</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{chore.frequency}</span>
      <span className="text-xs font-bold text-accent-primary">{chore.points}pts</span>
    </div>
  )
}

function ChoreOverlay({ chore }: { chore: RosterChore | Chore }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-card border-2 border-accent-primary text-sm font-medium text-text-primary shadow-lg cursor-grabbing select-none">
      <GripVertical className="h-3.5 w-3.5 text-accent-primary flex-shrink-0" />
      <span className="flex-1 truncate">{chore.title}</span>
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{chore.frequency}</span>
      <span className="text-xs font-bold text-accent-primary">{chore.points}pts</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Droppable column                                                  */
/* ------------------------------------------------------------------ */

function DroppableColumn({
  id,
  label,
  color,
  children,
}: {
  id: string
  label: string
  color?: string | null
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border transition-colors min-h-[200px] ${isOver ? 'border-accent-primary bg-accent-primary/5' : 'border-border-default bg-surface-base'}`}
    >
      <div
        className="px-4 py-3 rounded-t-2xl font-bold text-sm"
        style={color ? { backgroundColor: color + '22', borderBottom: `2px solid ${color}`, color } : undefined}
      >
        {!color && <span className="text-text-primary">{label}</span>}
        {color && label}
      </div>
      <div className="flex-1 p-3 space-y-2">
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function RosterManager({ onUpdate }: RosterManagerProps) {
  const [rosters, setRosters] = useState<Roster[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [allChores, setAllChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChore, setActiveChore] = useState<(RosterChore | Chore) | null>(null)

  // Create roster state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  // Add chore state
  const [showAddChore, setShowAddChore] = useState(false)
  const [choreTitle, setChoreTitle] = useState('')
  const [chorePoints, setChorePoints] = useState(0)
  const [choreFrequency, setChoreFrequency] = useState('daily')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/rosters/').then(r => r.json()),
      fetch('/api/rosters/family-members').then(r => r.json()),
      fetch('/api/chores/').then(r => r.json()),
    ]).then(([rostersData, membersData, choresData]) => {
      setRosters(rostersData)
      setMembers(membersData)
      setAllChores(choresData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-create rosters for children without one
  const [didAutoCreate, setDidAutoCreate] = useState(false)
  useEffect(() => {
    if (loading || didAutoCreate || members.length === 0) return

    const assignedUserIds = new Set(
      rosters.flatMap(r => r.assignments.map(a => a.user_id))
    )
    const unassigned = members.filter(m => !assignedUserIds.has(m.id))

    if (unassigned.length === 0) return

    setDidAutoCreate(true)
    // For each unassigned child, create a roster and assign them
    Promise.all(
      unassigned.map(m =>
        fetch('/api/rosters/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${m.name}'s Roster` }),
        })
          .then(r => r.json())
          .then(roster =>
            fetch(`/api/rosters/${roster.id}/assign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_ids: [m.id] }),
            })
          )
      )
    ).then(() => { fetchData(); onUpdate() })
  }, [loading, didAutoCreate, members, rosters, fetchData, onUpdate])

  // Build the chore pool: chores without a roster_id that aren't bonus
  const rosteredChoreIds = new Set(rosters.flatMap(r => r.chores.map(c => c.id)))
  const chorePool = allChores.filter(c => !c.roster_id && !c.is_bonus && !rosteredChoreIds.has(c.id))

  // Map from member id -> roster (use the first roster assigned to them)
  const memberRosterMap = new Map<number, Roster>()
  for (const r of rosters) {
    for (const a of r.assignments) {
      if (!memberRosterMap.has(a.user_id)) {
        memberRosterMap.set(a.user_id, r)
      }
    }
  }

  /* ---- DnD handlers ---- */

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (data?.chore) setActiveChore(data.chore)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveChore(null)
    const { active, over } = event
    if (!over) return

    const data = active.data.current
    if (!data?.chore) return

    const chore = data.chore as (RosterChore | Chore)
    const sourceStr = data.source as string
    const targetId = over.id as string

    // Dropping onto pool
    if (targetId === 'pool') {
      if (sourceStr.startsWith('roster-')) {
        const rosterId = parseInt(sourceStr.replace('roster-', ''))
        fetch(`/api/rosters/${rosterId}/chores/${chore.id}`, { method: 'DELETE' })
          .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
          .then(() => { fetchData(); onUpdate() })
          .catch(err => toast.error(err.message))
      }
      return
    }

    // Dropping onto a child column (column id = "child-{memberId}")
    if (targetId.startsWith('child-')) {
      const memberId = parseInt(targetId.replace('child-', ''))
      const targetRoster = memberRosterMap.get(memberId)
      if (!targetRoster) return

      // If already in this roster, do nothing
      if (sourceStr === `roster-${targetRoster.id}`) return

      fetch(`/api/rosters/${targetRoster.id}/chores/from/${chore.id}`, { method: 'POST' })
        .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
        .then(() => { fetchData(); onUpdate() })
        .catch(err => toast.error(err.message))
    }
  }

  /* ---- Roster CRUD ---- */

  const handleCreateRoster = () => {
    if (!newName.trim()) return
    fetch('/api/rosters/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(() => { toast.success('Roster created!'); setNewName(''); setShowCreate(false); fetchData(); onUpdate() })
      .catch(err => toast.error(err.message))
  }

  const handleDeleteRoster = (id: number) => {
    if (!confirm('Delete this roster and all its chores?')) return
    fetch(`/api/rosters/${id}`, { method: 'DELETE' })
      .then(() => { toast.success('Roster deleted'); fetchData(); onUpdate() })
  }

  const handleAddChore = () => {
    if (!choreTitle.trim()) return
    fetch('/api/chores/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: choreTitle, points: chorePoints, frequency: choreFrequency }),
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(() => {
        toast.success('Chore added to pool!')
        setChoreTitle(''); setChorePoints(0); setChoreFrequency('daily'); setShowAddChore(false)
        fetchData(); onUpdate()
      })
      .catch(err => toast.error(err.message))
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-text-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-3" />
        Loading rosters...
      </div>
    )
  }

  // Children who have a roster
  const childrenWithRosters = members.filter(m => memberRosterMap.has(m.id))

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-text-primary">Rosters</h2>
          <div className="flex gap-2">
            <NeuButton variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
              <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New Roster</span>
            </NeuButton>
            <NeuButton variant="teal" size="sm" onClick={() => setShowAddChore(true)}>
              <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New Chore</span>
            </NeuButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: Child columns */}
          <div className="space-y-4">
            {childrenWithRosters.length === 0 && (
              <NeuCard>
                <p className="text-text-muted text-center py-8">
                  No children have rosters yet. They will be created automatically.
                </p>
              </NeuCard>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {childrenWithRosters.map(member => {
                const roster = memberRosterMap.get(member.id)!
                const color = member.color || roster.assignments.find(a => a.user_id === member.id)?.color
                return (
                  <div key={member.id} className="relative group">
                    <DroppableColumn
                      id={`child-${member.id}`}
                      label={member.name}
                      color={color}
                    >
                      {roster.chores.length === 0 && (
                        <p className="text-xs text-text-muted text-center py-4">
                          Drop chores here
                        </p>
                      )}
                      {roster.chores.map(chore => (
                        <DraggableChore key={chore.id} chore={chore} source={`roster-${roster.id}`} />
                      ))}
                    </DroppableColumn>
                    <button
                      onClick={() => handleDeleteRoster(roster.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-raised text-text-muted hover:text-accent-red transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Chore pool */}
          <DroppableColumn id="pool" label="Chore Pool">
            {chorePool.length === 0 && (
              <p className="text-xs text-text-muted text-center py-4">
                All chores assigned! Create more with the button above.
              </p>
            )}
            {chorePool.map(chore => (
              <DraggableChore key={chore.id} chore={chore} source="pool" />
            ))}
          </DroppableColumn>
        </div>
      </div>

      <DragOverlay>
        {activeChore ? <ChoreOverlay chore={activeChore} /> : null}
      </DragOverlay>

      {/* Create Roster Modal */}
      <NeuModal open={showCreate} onClose={() => setShowCreate(false)} title="New Roster">
        <div className="space-y-4">
          <NeuInput label="Roster Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Weekday Chores" />
          <NeuButton variant="teal" className="w-full" onClick={handleCreateRoster}>Create Roster</NeuButton>
        </div>
      </NeuModal>

      {/* Add Chore Modal */}
      <NeuModal open={showAddChore} onClose={() => setShowAddChore(false)} title="New Chore">
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
    </DndContext>
  )
}
