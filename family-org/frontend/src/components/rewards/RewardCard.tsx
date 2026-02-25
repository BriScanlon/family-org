import { Gift } from 'lucide-react'
import clsx from 'clsx'
import { NeuButton } from '../ui/NeuButton'
import type { Reward } from '../../types'

interface RewardCardProps {
  reward: Reward
  userBalance: number
  onRedeem: (rewardId: number) => void
}

export function RewardCard({ reward, userBalance, onRedeem }: RewardCardProps) {
  const canRedeem = !reward.is_redeemed && userBalance >= reward.cost

  return (
    <div className={clsx(
      'bg-surface-card border rounded-2xl overflow-hidden transition-all duration-150',
      reward.is_redeemed ? 'border-border-muted opacity-60' : 'border-border-default card-shadow hover:card-shadow-hover'
    )}>
      <div className="h-24 flex items-center justify-center bg-surface-raised relative border-b border-border-muted">
        <Gift className={clsx(
          'h-10 w-10',
          reward.is_redeemed ? 'text-text-muted' : 'text-accent-amber'
        )} />
        {reward.is_redeemed && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-card/70">
            <span className="text-text-muted text-xs font-bold uppercase tracking-widest bg-surface-raised border border-border-default px-3 py-1 rounded-full">
              Redeemed
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-text-primary text-lg mb-3">{reward.title}</h3>
        <div className="flex items-center justify-between">
          <span className="font-bold text-accent-amber text-lg">£{reward.cost.toFixed(2)}</span>
          <NeuButton
            variant="amber"
            size="sm"
            onClick={() => onRedeem(reward.id)}
            disabled={!canRedeem}
          >
            {reward.is_redeemed ? 'Redeemed' : 'Redeem'}
          </NeuButton>
        </div>
      </div>
    </div>
  )
}
