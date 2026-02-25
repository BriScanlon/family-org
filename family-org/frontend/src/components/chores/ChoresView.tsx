import { Plus, LayoutGrid, Table, CheckCircle2, Lock, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { NeuButton } from '../ui/NeuButton'
import { NeuCard } from '../ui/NeuCard'
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
  const [layout, setLayout] = useState<'cards' | 'table'>('cards')
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
            <div className="flex items-center gap-2">
              <div className="flex bg-surface-base rounded-xl p-1 border border-border-muted">
                <button
                  onClick={() => setLayout('cards')}
                  className={clsx(
                    'p-1.5 rounded-lg transition-all',
                    layout === 'cards' ? 'bg-surface-card text-accent-primary card-shadow' : 'text-text-muted hover:text-text-primary'
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLayout('table')}
                  className={clsx(
                    'p-1.5 rounded-lg transition-all',
                    layout === 'table' ? 'bg-surface-card text-accent-primary card-shadow' : 'text-text-muted hover:text-text-primary'
                  )}
                  title="Table view"
                >
                  <Table className="h-4 w-4" />
                </button>
              </div>
              {isParent && (
                <NeuButton variant="teal" onClick={() => setShowModal(true)}>
                  <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Chore</span>
                </NeuButton>
              )}
            </div>
          </div>

          {layout === 'cards' ? (
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
          ) : (
            <NeuCard className="!p-0 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-default bg-surface-raised/50">
                    <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Frequency</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Reward</th>
                    {isParent && <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {chores.map(chore => {
                    const isLocked = chore.is_bonus && !standardChoresDone
                    const canComplete = !chore.is_completed && !isLocked
                    return (
                      <tr key={chore.id} className={clsx(
                        'transition-colors',
                        chore.is_completed ? 'opacity-50' : isLocked ? 'opacity-40' : 'hover:bg-surface-raised/30'
                      )}>
                        <td className="px-4 py-3">
                          {chore.is_completed ? (
                            <CheckCircle2 className="h-5 w-5 text-accent-primary" />
                          ) : isLocked ? (
                            <Lock className="h-5 w-5 text-text-muted" />
                          ) : (
                            <button
                              onClick={() => onComplete(chore.id)}
                              className="h-5 w-5 rounded-full border-2 border-border-default hover:border-accent-primary transition-colors"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-sm font-medium',
                            chore.is_completed ? 'line-through text-text-muted' : 'text-text-primary'
                          )}>
                            {chore.title}
                          </span>
                          {chore.source === 'go4schools' && (
                            <span className="ml-2 text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full uppercase">
                              Homework
                            </span>
                          )}
                          {chore.due_date && (
                            <span className="ml-2 text-xs text-text-muted">
                              Due: {new Date(chore.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide',
                            chore.is_bonus ? 'bg-accent-amber/15 text-accent-amber' : 'bg-accent-primary/10 text-accent-primary'
                          )}>
                            {chore.is_bonus ? 'Bonus' : 'Standard'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-text-muted capitalize">{chore.frequency}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {chore.is_bonus ? (
                            <span className="text-sm font-bold text-accent-amber">£{chore.reward_money.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs font-bold text-text-muted">Required</span>
                          )}
                        </td>
                        {isParent && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {chore.is_completed && (
                                <button
                                  onClick={() => onUncomplete(chore.id)}
                                  className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted hover:text-accent-amber transition-colors"
                                  title="Undo"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {chore.source !== 'go4schools' && (
                                <>
                                  <button
                                    onClick={() => setEditingChore(chore)}
                                    className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted hover:text-accent-primary transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { if (confirm('Delete this chore?')) onDelete(chore.id) }}
                                    className="p-1.5 hover:bg-surface-raised rounded-lg text-text-muted hover:text-accent-red transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {chores.length === 0 && (
                <p className="text-text-muted text-center py-8 text-sm">No chores yet.</p>
              )}
            </NeuCard>
          )}

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
