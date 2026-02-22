import { useState } from 'react'
import { NeuModal } from '../ui/NeuModal'
import { NeuInput } from '../ui/NeuInput'
import { NeuButton } from '../ui/NeuButton'

interface AddRewardModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (reward: { title: string; cost: number }) => void
}

export function AddRewardModal({ open, onClose, onSubmit }: AddRewardModalProps) {
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState(5.00)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ title, cost })
    setTitle('')
    setCost(5.00)
  }

  return (
    <NeuModal open={open} onClose={onClose} title="Add New Reward">
      <form onSubmit={handleSubmit} className="space-y-4">
        <NeuInput
          label="Reward Title"
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g., Movie Night"
        />
        <NeuInput
          label="Cost (£)"
          type="number"
          step="0.01"
          required
          value={cost}
          onChange={e => setCost(parseFloat(e.target.value))}
        />
        <div className="pt-2">
          <NeuButton type="submit" variant="amber" className="w-full" size="lg">
            Create Reward
          </NeuButton>
        </div>
      </form>
    </NeuModal>
  )
}
