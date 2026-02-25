import { Plus } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { NeuButton } from '../ui/NeuButton'
import { ChoreCard } from './ChoreCard'
import { AddChoreModal } from './AddChoreModal'
import { RosterManager } from '../rosters/RosterManager'
import type { Chore } from '../../types'

interface ChoresViewProps {
  chores: Chore[]
  onComplete: (choreId: number) => void
  onCreate: (chore: { title: string; points: number; reward_money: number; is_bonus: boolean; frequency: string }) => void
  onEdit: (choreId: number, chore: { title: string; points: number; reward_money: number; is_bonus: boolean; frequency: string }) => void
  onDelete: (choreId: number) => void
  onUncomplete: (choreId: number) => void
  isParent: boolean
  onUpdate: () => void
}

export function ChoresView({ chores, onComplete, onCreate, onEdit, onDelete, onUncomplete, isParent, onUpdate }: ChoresViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingChore, setEditingChore] = useState<Chore | null>(null)
  const [subTab, setSubTab] = useState<'chores' | 'rosters'>('chores')
  const standardChoresDone = chores.filter(c => !c.is_bonus && !c.is_completed).length === 0

  return (
    <div>
      {isParent && (
        <div className="flex bg-surface-base rounded-xl p-1 border border-border-muted mb-6 w-fit">
          <button
            onClick={() => setSubTab('chores')}
            className={clsx(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
              subTab === 'chores' ? 'bg-surface-card text-accent-primary card-shadow' : 'text-text-muted hover:text-text-primary'
            )}
          >
            All Chores
          </button>
          <button
            onClick={() => setSubTab('rosters')}
            className={clsx(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
              subTab === 'rosters' ? 'bg-surface-card text-accent-primary card-shadow' : 'text-text-muted hover:text-text-primary'
            )}
          >
            Rosters
          </button>
        </div>
      )}

      {subTab === 'rosters' && isParent ? (
        <RosterManager onUpdate={onUpdate} />
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Manage Chores</h2>
            {isParent && (
              <NeuButton variant="teal" onClick={() => setShowModal(true)}>
                <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Chore</span>
              </NeuButton>
            )}
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
        </>
      )}
    </div>
  )
}
