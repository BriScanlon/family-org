import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, 
  CheckCircle2, 
  Gift, 
  User as UserIcon, 
  Bell, 
  Settings, 
  LogOut, 
  ChevronRight,
  Plus,
  Zap,
  X,
  Wallet,
  Clock,
  Lock,
  CalendarDays,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import clsx from 'clsx'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { CalendarView } from './components/CalendarView'
import { SettingsView } from './components/SettingsView'

interface User {
  id: number;
  name: string;
  email: string;
  points: number;
  balance: number;
  role: string;
  synced_calendars: string[];
}

interface Chore {
  id: number;
  title: string;
  points: number;
  reward_money: number;
  is_completed: boolean;
  is_bonus: boolean;
  frequency: string;
}

interface Reward {
  id: number;
  title: string;
  cost: number;
  is_redeemed: boolean;
}

interface Event {
  id: number;
  summary: string;
  start_time: string;
  user_name: string;
  location?: string;
}

interface Alert {
  id: number;
  message: string;
  type: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [chores, setChores] = useState<Chore[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'chores' | 'rewards' | 'settings'>('dashboard')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAddChoreModal, setShowAddChoreModal] = useState(false)
  const [showAddRewardModal, setShowAddRewardModal] = useState(false)
  const [newChore, setNewChore] = useState({ title: '', points: 0, reward_money: 0, is_bonus: false, frequency: 'daily' })
  const [newReward, setNewReward] = useState({ title: '', cost: 5.00 })
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
      fetch('/api/dashboard/alerts').then(res => res.json())
    ]).then(([userData, choresData, rewardsData, eventsData, alertsData]) => {
      setUser(userData)
      setChores(choresData)
      setRewards(rewardsData)
      setEvents(eventsData)
      setAlerts(alertsData || [])
      setLoading(false)
    })
  }

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}/api/dashboard/ws`)
    
    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log("WebSocket message:", message)
      fetchData()
    }

    return () => {
      if (ws.current) ws.current.close()
    }
  }

  const handleCompleteChore = (choreId: number) => {
    if (!user) return
    fetch(`/api/chores/${choreId}/complete?user_id=${user.id}`, { method: 'PUT' })
      .then(res => {
        if (!res.ok) return res.json().then(data => { throw new Error(data.detail) })
        return res.json()
      })
      .then(() => {
        toast.success("Chore completed!")
        fetchData()
      })
      .catch(err => {
        toast.error(err.message)
      })
  }

  const handleCreateChore = (e: React.FormEvent) => {
    e.preventDefault()
    fetch('/api/chores/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newChore)
    })
      .then(res => res.json())
      .then(() => {
        toast.success("Chore created!")
        fetchData()
        setShowAddChoreModal(false)
        setNewChore({ title: '', points: 0, reward_money: 0, is_bonus: false, frequency: 'daily' })
      })
  }

  const handleCreateReward = (e: React.FormEvent) => {
    e.preventDefault()
    fetch('/api/rewards/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReward)
    })
      .then(res => res.json())
      .then(() => {
        toast.success("Reward created!")
        fetchData()
        setShowAddRewardModal(false)
        setNewReward({ title: '', cost: 5.00 })
      })
  }

  const handleRedeemReward = (rewardId: number) => {
    if (!user) return
    fetch(`/api/rewards/${rewardId}/redeem?user_id=${user.id}`, { method: 'POST' })
      .then(res => {
        if (!res.ok) return res.json().then(data => { throw new Error(data.detail) })
        return res.json()
      })
      .then(() => {
        toast.success("Reward redeemed!")
        fetchData()
      })
      .catch(err => {
        toast.error(err.message)
      })
  }

  const handleAlertFeedback = (alertId: number, feedback: number) => {
    fetch(`/api/dashboard/alerts/${alertId}/feedback?feedback=${feedback}`, { method: 'POST' })
      .then(() => {
        toast.info("Feedback sent!")
        fetchData()
      })
  }

  const handleLogin = () => {
    window.location.href = '/api/auth/login'
  }

  const areStandardChoresDone = chores.filter(c => !c.is_bonus && !c.is_completed).length === 0

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100 p-4">
        <ToastContainer position="bottom-right" />
        <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              Family Org
            </h1>
            <p className="text-slate-500">Organize your family life with style.</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 transform hover:scale-[1.02]"
          >
            <span className="mr-2">Sign in with Google</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <ToastContainer position="bottom-right" theme="colored" />
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <div className="bg-primary-600 text-white p-1.5 rounded-lg">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-800">FamilyOrg</span>
              </div>
              
              <div className="hidden md:flex space-x-1">
                {['dashboard', 'calendar', 'chores', 'rewards'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={clsx(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                      activeTab === tab 
                        ? "bg-primary-50 text-primary-700" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Balance</span>
                <span className="font-bold text-emerald-600">£{user.balance.toFixed(2)}</span>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:bg-slate-100 p-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary-500 to-accent-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                    {user.name.charAt(0)}
                  </div>
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 py-1 focus:outline-none z-50 origin-top-right"
                    >
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                      <button 
                        onClick={() => { setActiveTab('settings'); setShowUserMenu(false); }}
                        className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Settings className="mr-3 h-4 w-4 text-slate-400" />
                        Settings
                      </button>
                      <button 
                        onClick={() => window.location.href = '/api/auth/logout'}
                        className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="mr-3 h-4 w-4 text-red-500" />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* AI Alerts Bar */}
        <AnimatePresence>
          {alerts.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-8 space-y-3"
            >
              {alerts.map(alert => (
                <div key={alert.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-amber-800">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mr-2">Was this helpful?</span>
                    <button 
                      onClick={() => handleAlertFeedback(alert.id, 1)}
                      className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 transition-colors"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleAlertFeedback(alert.id, -1)}
                      className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 transition-colors"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Upcoming Events */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary-500" />
                      Upcoming Events
                    </h2>
                    <button onClick={() => setActiveTab('calendar')} className="text-sm text-primary-600 font-medium hover:text-primary-700">View All</button>
                  </div>
                  
                  {events.length > 0 ? (
                    <div className="space-y-4">
                      {events.slice(0, 5).map((event) => (
                        <div key={event.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-center min-w-[3.5rem]">
                            <span className="block text-xs font-bold text-slate-500 uppercase">
                              {new Date(event.start_time).toLocaleString('default', { month: 'short' })}
                            </span>
                            <span className="block text-xl font-bold text-slate-800">
                              {new Date(event.start_time).getDate()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{event.summary}</h3>
                              <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-bold">
                                {event.user_name}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {event.location && ` @ ${event.location}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No upcoming events</p>
                      <p className="text-xs text-slate-400 mt-1">Your calendar is clear for now.</p>
                    </div>
                  )}
                </div>

                {/* Quick Actions / Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                    <p className="text-emerald-100 text-sm font-medium mb-1">Total Balance</p>
                    <h3 className="text-3xl font-bold">£{user.balance.toFixed(2)}</h3>
                  </div>
                  <div 
                    onClick={() => setActiveTab('rewards')}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center cursor-pointer hover:shadow-md transition-shadow group"
                  >
                    <div className="bg-accent-50 p-3 rounded-full mb-3 group-hover:bg-accent-100 transition-colors">
                      <Gift className="h-6 w-6 text-accent-600" />
                    </div>
                    <span className="font-medium text-slate-700">Redeem Rewards</span>
                  </div>
                </div>
              </div>

              {/* Today's Tasks Sidebar */}
              <div className="md:col-span-1">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Standard Tasks
                    </h2>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      {chores.filter(c => !c.is_bonus && !c.is_completed).length} Left
                    </span>
                  </div>

                  <div className="space-y-3">
                    {chores.filter(c => !c.is_bonus).slice(0, 10).map((chore) => (
                      <div 
                        key={chore.id} 
                        className={clsx(
                          "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200",
                          chore.is_completed 
                            ? "bg-slate-50 border-slate-100 opacity-60" 
                            : "bg-white border-slate-200 hover:border-primary-300 hover:shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => !chore.is_completed && handleCompleteChore(chore.id)}
                            disabled={chore.is_completed}
                            className={clsx(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              chore.is_completed
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-slate-300 group-hover:border-primary-500"
                            )}
                          >
                            {chore.is_completed && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                          <div>
                            <p className={clsx("text-sm font-medium", chore.is_completed ? "line-through text-slate-400" : "text-slate-700")}>
                              {chore.title}
                            </p>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {chore.frequency}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 border-t border-slate-100 pt-6">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Bonus Jobs
                    </h2>
                    {!areStandardChoresDone && (
                      <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2 mb-4 border border-amber-100">
                        <Lock className="h-4 w-4 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-700 font-medium">Complete all standard chores to unlock bonus jobs!</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {chores.filter(c => c.is_bonus).map((chore) => (
                        <div 
                          key={chore.id} 
                          className={clsx(
                            "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200",
                            chore.is_completed 
                              ? "bg-slate-50 border-slate-100 opacity-60" 
                              : !areStandardChoresDone 
                                ? "bg-slate-100 border-slate-100 opacity-50 cursor-not-allowed"
                                : "bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm"
                          )}
                        >
                           <div className="flex items-center gap-3">
                            <button
                              onClick={() => !chore.is_completed && areStandardChoresDone && handleCompleteChore(chore.id)}
                              disabled={chore.is_completed || !areStandardChoresDone}
                              className={clsx(
                                "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                chore.is_completed
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-slate-300 group-hover:border-amber-500"
                              )}
                            >
                              {chore.is_completed && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </button>
                            <p className={clsx("text-sm font-medium", chore.is_completed ? "line-through text-slate-400" : "text-slate-700")}>
                              {chore.title}
                            </p>
                          </div>
                          <span className={clsx("text-xs font-bold", chore.is_completed ? "text-slate-400" : "text-emerald-600")}>
                            +£{chore.reward_money.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && <CalendarView events={events} />}

          {activeTab === 'chores' && (
            <div className="md:col-span-3">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Manage Chores</h2>
                <button 
                  onClick={() => setShowAddChoreModal(true)}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-primary-700 flex items-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Chore
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {chores.map((chore) => (
                  <motion.div 
                    key={chore.id}
                    whileHover={{ y: -4 }}
                    className={clsx(
                      "bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between h-44",
                      chore.is_completed && "opacity-75 bg-slate-50"
                    )}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className={clsx(
                          "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide",
                          chore.is_bonus ? "bg-amber-100 text-amber-700" : "bg-primary-100 text-primary-700"
                        )}>
                          {chore.is_bonus ? 'Bonus' : chore.frequency}
                        </span>
                        {chore.is_bonus ? (
                          <span className="font-bold text-emerald-600">£{chore.reward_money.toFixed(2)}</span>
                        ) : (
                          <span className="font-bold text-slate-400 italic">Required</span>
                        )}
                      </div>
                      <h3 className={clsx("text-lg font-semibold", chore.is_completed ? "text-slate-500 line-through" : "text-slate-800")}>
                        {chore.title}
                      </h3>
                    </div>
                    
                    <button
                      onClick={() => !chore.is_completed && (chore.is_bonus ? areStandardChoresDone : true) && handleCompleteChore(chore.id)}
                      disabled={chore.is_completed || (chore.is_bonus && !areStandardChoresDone)}
                      className={clsx(
                        "w-full py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2",
                        chore.is_completed
                          ? "bg-green-100 text-green-700 cursor-default"
                          : (chore.is_bonus && !areStandardChoresDone)
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                      )}
                    >
                      {chore.is_completed ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Completed
                        </>
                      ) : chore.is_bonus && !areStandardChoresDone ? (
                        <>
                           <Lock className="h-4 w-4" /> Locked
                        </>
                      ) : "Mark Complete"}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="md:col-span-3">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Rewards Gallery</h2>
                <button 
                  onClick={() => setShowAddRewardModal(true)}
                  className="bg-accent-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-accent-700 flex items-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Reward
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {rewards.map((reward) => (
                  <div key={reward.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
                    <div className="h-32 bg-gradient-to-br from-accent-400 to-purple-600 flex items-center justify-center relative">
                      <Gift className="h-12 w-12 text-white opacity-90 group-hover:scale-110 transition-transform duration-300" />
                      {reward.is_redeemed && (
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                           <span className="bg-white text-slate-900 px-3 py-1 rounded-full font-bold text-xs uppercase">Redeemed</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-slate-800 text-lg mb-1">{reward.title}</h3>
                      <p className="text-sm text-slate-500 mb-4">Unlock this special reward!</p>
                      
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">£{reward.cost.toFixed(2)}</span>
                        <button 
                          onClick={() => handleRedeemReward(reward.id)}
                          disabled={user.balance < reward.cost || reward.is_redeemed}
                          className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                            reward.is_redeemed 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : user.balance >= reward.cost
                                ? "bg-accent-600 text-white hover:bg-accent-700 shadow-md shadow-accent-600/20"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          )}
                        >
                          {reward.is_redeemed ? "Redeemed" : "Redeem"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && <SettingsView user={user} onUpdate={fetchData} />}
        </motion.div>
      </main>

      {/* Add Chore Modal */}
      <AnimatePresence>
        {showAddChoreModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddChoreModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Add New Chore</h3>
                <button 
                  onClick={() => setShowAddChoreModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleCreateChore} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Chore Title</label>
                  <input
                    type="text"
                    required
                    value={newChore.title}
                    onChange={(e) => setNewChore({ ...newChore, title: e.target.value })}
                    placeholder="e.g., Wash the dishes"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      id="is_bonus"
                      checked={newChore.is_bonus}
                      onChange={(e) => setNewChore({ ...newChore, is_bonus: e.target.checked })}
                      className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="is_bonus" className="text-sm font-medium text-slate-700">
                      Bonus Chore?
                    </label>
                  </div>

                  {!newChore.is_bonus && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Frequency</label>
                      <select
                        value={newChore.frequency}
                        onChange={(e) => setNewChore({ ...newChore, frequency: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="once">Once</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {newChore.is_bonus && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Reward Money (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newChore.reward_money}
                      onChange={(e) => setNewChore({ ...newChore, reward_money: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                    />
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all transform active:scale-[0.98]"
                  >
                    Create Chore
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddRewardModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddRewardModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Add New Reward</h3>
                <button 
                  onClick={() => setShowAddRewardModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleCreateReward} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Reward Title</label>
                  <input
                    type="text"
                    required
                    value={newReward.title}
                    onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                    placeholder="e.g., Movie Night"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Cost (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newReward.cost}
                    onChange={(e) => setNewReward({ ...newReward, cost: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-accent-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-accent-600/20 hover:bg-accent-700 transition-all transform active:scale-[0.98]"
                  >
                    Create Reward
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
