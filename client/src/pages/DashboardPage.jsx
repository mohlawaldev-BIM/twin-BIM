import { useEffect, useState } from 'react'
import { useAuth } from '../components/Auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  Building2, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Upload, ArrowRight, Zap
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const STATUS_COLORS = {
  operational:  '#22c55e',
  maintenance:  '#f59e0b',
  critical:     '#ef4444',
  decommissioned:'#6b7280',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats,  setStats]  = useState({ total: 0, operational: 0, maintenance: 0, critical: 0 })
  const [recent, setRecent] = useState([])
  const [trend,  setTrend]  = useState([])
  const [loading, setLoading] = useState(true)

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  useEffect(() => {
    async function load() {
      // Fetch all assets across pages (Supabase 1000-row default limit)
      const PAGE = 1000
      let assets = [], pg = 0, done = false
      while (!done) {
        const { data } = await supabase
          .from('assets')
          .select('id, name, status, category, last_updated')
          .eq('user_id', user.id)
          .order('last_updated', { ascending: false })
          .range(pg * PAGE, (pg + 1) * PAGE - 1)
        if (!data || data.length === 0) { done = true; break }
        assets = [...assets, ...data]
        if (data.length < PAGE) done = true
        else pg++
      }

      if (!assets.length) { setLoading(false); return }

      const counts = { total: assets.length, operational: 0, maintenance: 0, critical: 0, decommissioned: 0 }
      assets.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++ })
      setStats(counts)
      setRecent(assets.slice(0, 5))

      // Build simple 7-day trend from audit log
      const { data: audit } = await supabase
        .from('audit_log')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

      const days = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        days[d.toLocaleDateString('en', { weekday: 'short' })] = 0
      }
      audit?.forEach(a => {
        const d = new Date(a.created_at).toLocaleDateString('en', { weekday: 'short' })
        if (days[d] !== undefined) days[d]++
      })
      setTrend(Object.entries(days).map(([day, events]) => ({ day, events })))
      setLoading(false)
    }
    load()
  }, [user.id])

  const pieData = [
    { name: 'Operational',  value: stats.operational,   color: STATUS_COLORS.operational  },
    { name: 'Maintenance',  value: stats.maintenance,   color: STATUS_COLORS.maintenance  },
    { name: 'Critical',     value: stats.critical,      color: STATUS_COLORS.critical     },
    { name: 'Decommissioned', value: stats.decommissioned, color: STATUS_COLORS.decommissioned },
  ].filter(d => d.value > 0)

  const statCards = [
    { label: 'Total Assets',   value: stats.total,        icon: Building2,    color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
    { label: 'Operational',    value: stats.operational,  icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10'  },
    { label: 'Needs Attention',value: stats.maintenance,  icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
    { label: 'Critical',       value: stats.critical,     icon: AlertTriangle,color: 'text-red-400',    bg: 'bg-red-500/10'    },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-400">
        <Zap size={20} className="animate-pulse text-blue-400" />
        Loading twin state…
      </div>
    </div>
  )

  if (stats.total === 0) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-6">
        <Upload size={32} className="text-blue-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Your Digital Twin is empty</h2>
      <p className="text-slate-400 mb-8">
        Import a COBie spreadsheet or add assets manually to bring your building to life.
      </p>
      <Link to="/upload" className="btn-primary inline-flex items-center gap-2">
        Import BIM Data <ArrowRight size={16} />
      </Link>
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Good day, {displayName} 👋</h1>
        <p className="text-slate-400 mt-1 text-sm">Here's the current state of your digital twin.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`${bg} ${color} p-3 rounded-xl`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity trend */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-blue-400" /> 7-Day Activity
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="events" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Asset breakdown pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Asset Status</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">No data yet</p>
          )}
        </div>
      </div>

      {/* Recent assets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">Recent Assets</h3>
          <Link to="/assets" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="space-y-2">
          {recent.map(asset => (
            <div key={asset.id} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: STATUS_COLORS[asset.status] || '#6b7280' }}
                />
                <div>
                  <p className="text-sm font-medium text-slate-200">{asset.name}</p>
                  <p className="text-xs text-slate-500">{asset.category}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium
                ${asset.status === 'operational'    ? 'bg-green-500/10 text-green-400' :
                  asset.status === 'maintenance'    ? 'bg-amber-500/10 text-amber-400' :
                  asset.status === 'critical'       ? 'bg-red-500/10 text-red-400'     :
                                                      'bg-slate-700 text-slate-400'}`}>
                {asset.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
