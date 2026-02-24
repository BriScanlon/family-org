import { Plus } from 'lucide-react'
import { useState } from 'react'
import { NeuButton } from '../ui/NeuButton'
import { ChoreCard } from './ChoreCard'
import { AddChoreModal } from './AddChoreModal'
import type { Chore } from '../../types'

interface ChoresViewProps {
  chores: Chore[]
  onComplete: (choreId: number) => void
  onCreate: (chore: { title: string; points: number; reward_money: number; is_bonus: boolean; frequency: string }) => void
  onEdit: (choreId: number, chore: { title: string; points: number; reward_money: number; is_bonus: boolean; frequency: string }) => void
  onDelete: (choreId: number) => void
  onUncomplete: (choreId: number) => void
  isParent: boolean
}

export function ChoresView({ chores, onComplete, onCreate, onEdit, onDelete, onUncomplete, isParent }: ChoresViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingChore, setEditingChore] = useState<Chore | null>(null)
  const standardChoresDone = chores.filter(c => !c.is_bonus && !c.is_completed).length === 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary">Manage Chores</h2>
        <NeuButton variant="teal" onClick={() => setShowModal(true)}>
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Chore
          </span>
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {chores.map(chore => (
          <ChoreCard
            key={chore.id}
            chore={chore}
            onComplete={onComplete}
            standardChoresDone={standardChoresDone}
            onEdit={setEditingChore}
            onDelete={onDelete}
            onUncomplete={onUncomplete}
            isParent={isParent}
          />
        ))}
      </div>

      <AddChoreModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={(chore) => { onCreate(chore); setShowModal(false) }}
      />

      <AddChoreModal
        open={editingChore !== null}
        onClose={() => setEditingChore(null)}
        onSubmit={(chore) => { onEdit(editingChore!.id, chore); setEditingChore(null) }}
        chore={editingChore}
      />
    </div>
  )
}
