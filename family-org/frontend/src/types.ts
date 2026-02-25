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

export interface RosterChore {
  id: number
  title: string
  points: number
  frequency: string
}

export interface RosterAssignment {
  id: number
  user_id: number
  user_name: string
  color?: string
}

export interface Roster {
  id: number
  name: string
  created_by: number
  chores: RosterChore[]
  assignments: RosterAssignment[]
}

export interface FamilyMember {
  id: number
  name: string
  email: string
  color?: string
}

export interface MyChore {
  id: number
  title: string
  points: number
  frequency: string
  is_completed: boolean
  roster_name?: string
}

export interface MyRoster {
  roster_id: number
  roster_name: string
  chores: MyChore[]
  completed: number
  total: number
}

export interface MyChoresResponse {
  rosters: MyRoster[]
  unassigned: MyChore[]
  bonus_unlocked: boolean
  bonus_chores: MyChore[]
}

export interface FamilyChildOverview {
  user_id: number
  user_name: string
  color?: string | null
  rosters: MyRoster[]
}
