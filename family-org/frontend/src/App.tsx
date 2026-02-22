import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import type { User, Chore, Reward, Event, Alert, LeagueEntry } from './types'
import { Navbar } from './components/layout/Navbar'
import { BottomNav } from './components/layout/BottomNav'
import { Dashboard } from './components/dashboard/Dashboard'
import { ChoresView } from './components/chores/ChoresView'
import { RewardsView } from './components/rewards/RewardsView'
import { CalendarView } from './components/calendar/CalendarView'
import { SettingsView } from './components/settings/SettingsView'
import { NeuCard } from './components/ui/NeuCard'
import { NeuButton } from './components/ui/NeuButton'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [chores, setChores] = useState<Chore[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [leagueTable, setLeagueTable] = useState<LeagueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'chores' | 'rewards' | 'settings'>('dashboard')
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Not logged in')
      })
      .then(userData => {
        setUser(userData)
        fetchData()
        setupWebSocket()
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const fetchData = () => {
    Promise.all([
      fetch('/api/auth/me').then(res => res.json()),
      fetch('/api/chores/').then(res => res.json()),
      fetch('/api/rewards/').then(res => res.json()),
      fetch('/api/dashboard/events').then(res => res.json()),
      fetch('/api/dashboard/alerts').then(res => res.json()),
      fetch('/api/dashboard/league-table').then(res => res.json())
    ]).then(([userData, choresData, rewardsData, eventsData, alertsData, leagueData]) => {
      setUser(userData)
      setChores(choresData)
      setRewards(rewardsData)
      setEvents(eventsData)
      setAlerts(alertsData || [])
      setLeagueTable(leagueData || [])
      setLoading(false)
    })
  }

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws.current = new WebSocket(`${protocol}//${window.location.host}/api/dashboard/ws`)
    ws.current.onmessage = () => { fetchData() }
    return () => { if (ws.current) ws.current.close() }
  }

  const handleCompleteChore = (choreId: number) => {
    if (!user) return
    fetch(`/api/chores/${choreId}/complete?user_id=${user.id}`, { method: 'PUT' })
      .then(res => {
        if (!res.ok) return res.json().then(data => { throw new Error(data.detail) })
        return res.json()
      })
      .then(() => { toast.success('Chore completed!'); fetchData() })
      .catch(err => { toast.error(err.message) })
  }

  const handleCreateChore = (chore: { title: string; points: number; reward_money: number; is_bonus: boolean; frequency: string }) => {
    fetch('/api/chores/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chore)
    })
      .then(res => res.json())
      .then(() => { toast.success('Chore created!'); fetchData() })
  }

  const handleCreateReward = (reward: { title: string; cost: number }) => {
    fetch('/api/rewards/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reward)
    })
      .then(res => res.json())
      .then(() => { toast.success('Reward created!'); fetchData() })
  }

  const handleRedeemReward = (rewardId: number) => {
    if (!user) return
    fetch(`/api/rewards/${rewardId}/redeem?user_id=${user.id}`, { method: 'POST' })
      .then(res => {
        if (!res.ok) return res.json().then(data => { throw new Error(data.detail) })
        return res.json()
      })
      .then(() => { toast.success('Reward redeemed!'); fetchData() })
      .catch(err => { toast.error(err.message) })
  }

  const handleAlertFeedback = (alertId: number, feedback: number) => {
    fetch(`/api/dashboard/alerts/${alertId}/feedback?feedback=${feedback}`, { method: 'POST' })
      .then(() => { toast.info('Feedback sent!'); fetchData() })
  }

  const handleLogin = () => { window.location.href = '/api/auth/login' }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neu-base">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-teal"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neu-base p-4">
        <ToastContainer position="bottom-right" theme="dark" />
        <NeuCard className="w-full max-w-md p-10 text-center">
          <h1 className="text-4xl font-extrabold text-text-primary tracking-tight mb-2">
            FamilyOrg
          </h1>
          <p className="text-text-muted mb-8">Organize your family life.</p>
          <NeuButton variant="teal" size="lg" className="w-full" onClick={handleLogin}>
            <span className="flex items-center justify-center gap-2">
              Sign in with Google <ChevronRight className="h-4 w-4" />
            </span>
          </NeuButton>
        </NeuCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neu-base font-sans text-text-primary flex flex-col">
      <ToastContainer position="bottom-right" theme="dark" />
      <Navbar user={user} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full pb-20 md:pb-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              user={user}
              chores={chores}
              events={events}
              leagueTable={leagueTable}
              alerts={alerts}
              onCompleteChore={handleCompleteChore}
              onAlertFeedback={handleAlertFeedback}
              onViewCalendar={() => setActiveTab('calendar')}
            />
          )}
          {activeTab === 'calendar' && <CalendarView events={events} />}
          {activeTab === 'chores' && (
            <ChoresView
              chores={chores}
              onComplete={handleCompleteChore}
              onCreate={handleCreateChore}
            />
          )}
          {activeTab === 'rewards' && (
            <RewardsView
              rewards={rewards}
              userBalance={user.balance}
              onRedeem={handleRedeemReward}
              onCreate={handleCreateReward}
            />
          )}
          {activeTab === 'settings' && <SettingsView user={user} onUpdate={fetchData} />}
        </motion.div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
