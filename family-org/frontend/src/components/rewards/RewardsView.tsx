import { Plus } from 'lucide-react'
import { useState } from 'react'
import { NeuButton } from '../ui/NeuButton'
import { RewardCard } from './RewardCard'
import { AddRewardModal } from './AddRewardModal'
import type { Reward } from '../../types'

interface RewardsViewProps {
  rewards: Reward[]
  userBalance: number
  onRedeem: (rewardId: number) => void
  onCreate: (reward: { title: string; cost: number }) => void
}

export function RewardsView({ rewards, userBalance, onRedeem, onCreate }: RewardsViewProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary">Rewards</h2>
        <NeuButton variant="amber" onClick={() => setShowModal(true)}>
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Reward
          </span>
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {rewards.map(reward => (
          <RewardCard
            key={reward.id}
            reward={reward}
            userBalance={userBalance}
            onRedeem={onRedeem}
          />
        ))}
      </div>

      <AddRewardModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={(reward) => { onCreate(reward); setShowModal(false) }}
      />
    </div>
  )
}
