import { useState } from 'react'
import { NeuModal } from '../ui/NeuModal'
import { NeuInput } from '../ui/NeuInput'
import { NeuButton } from '../ui/NeuButton'

interface AddChoreModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (chore: { title: string; points: number; reward_money: number; is_bonus: boolean; frequency: string }) => void
}

export function AddChoreModal({ open, onClose, onSubmit }: AddChoreModalProps) {
  const [title, setTitle] = useState('')
  const [isBonus, setIsBonus] = useState(false)
  const [frequency, setFrequency] = useState('daily')
  const [points, setPoints] = useState(0)
  const [rewardMoney, setRewardMoney] = useState(0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ title, points, reward_money: rewardMoney, is_bonus: isBonus, frequency })
    setTitle('')
    setPoints(0)
    setRewardMoney(0)
    setIsBonus(false)
    setFrequency('daily')
  }

  return (
    <NeuModal open={open} onClose={onClose} title="Add New Chore">
      <form onSubmit={handleSubmit} className="space-y-4">
        <NeuInput
          label="Chore Title"
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g., Wash the dishes"
        />

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-xl neu-raised-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isBonus}
              onChange={e => setIsBonus(e.target.checked)}
              className="h-4 w-4 rounded accent-accent-teal"
            />
            <span className="text-sm font-medium text-text-primary">Bonus Chore?</span>
          </label>

          {!isBonus && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-neu-base neu-inset-sm text-text-primary outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="once">Once</option>
              </select>
            </div>
          )}
        </div>

        {isBonus ? (
          <NeuInput
            label="Reward Money (£)"
            type="number"
            step="0.01"
            required
            value={rewardMoney}
            onChange={e => setRewardMoney(parseFloat(e.target.value))}
          />
        ) : (
          <NeuInput
            label="Points Value"
            type="number"
            required
            value={points}
            onChange={e => setPoints(parseInt(e.target.value))}
          />
        )}

        <div className="pt-2">
          <NeuButton type="submit" variant="teal" className="w-full" size="lg">
            Create Chore
          </NeuButton>
        </div>
      </form>
    </NeuModal>
  )
}
