export interface User {
  id: number
  name: string
  email: string
  points: number
  balance: number
  role: string
  synced_calendars: string[]
  preferences: Record<string, unknown>
}

export interface Chore {
  id: number
  title: string
  points: number
  reward_money: number
  is_completed: boolean
  is_bonus: boolean
  frequency: string
  source: string
  due_date?: string
  personal: boolean
}

export interface Reward {
  id: number
  title: string
  cost: number
  is_redeemed: boolean
}

export interface Event {
  id: number
  summary: string
  start_time: string
  user_name: string
  location?: string
}

export interface Alert {
  id: number
  message: string
  type: string
}

export interface LeagueEntry {
  user_id: number
  name: string
  standard_completed: number
  bonus_completed: number
  total_points: number
  total_balance: number
}

export interface GoogleCalendar {
  id: string
  summary: string
  primary?: boolean
}
