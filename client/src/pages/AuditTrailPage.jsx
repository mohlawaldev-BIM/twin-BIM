import { useEffect, useState } from 'react'
import { useAuth } from '../components/Auth/AuthContext'
import { supabase } from '../lib/supabase'
import { ClipboardList, Upload, Bot, Database, RefreshCw, Loader2 } from 'lucide-react'

const ENTITY_ICON = {
  asset:  { icon: Database,     color: 'text-blue-400',  bg: 'bg-blue-500/10'  },
  import: { icon: Upload,       color: 'text-green-400', bg: 'bg-green-500/10' },
  ai:     { icon: Bot,          color: 'text-purple-400',bg: 'bg-purple-500/10'},
}

export default function AuditTrailPage() {
  const { user }   = useAuth()
  const [logs,     setLogs]    = useState([])
  const [loading,  setLoading] = useState(true)
  const [page,     setPage]    = useState(0)
  const PER_PAGE = 25

  const load = async (p = 0) => {
    setLoading(true)
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(p * PER_PAGE, (p + 1) * PER_PAGE - 1)
    setLogs(data || [])
    setPage(p)
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <p className="text-slate-400 text-sm mt-0.5">ISO 19650-aligned record of all system activity.</p>
        </div>
        <button onClick={() => load(0)} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">No audit entries yet. Activity will appear here as you use TwinBIM.</p>
          </div>
        ) : (
          <div>
            {logs.map((log, i) => {
              const { icon: Icon, color, bg } = ENTITY_ICON[log.entity] || ENTITY_ICON.asset
              const dt = new Date(log.created_at)
              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-slate-800/60 last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-800/10'}`}
                >
                  <div className={`${bg} ${color} p-2 rounded-lg mt-0.5 shrink-0`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    log.entity === 'import' ? 'border-green-500/20 text-green-400 bg-green-500/10' :
                    log.entity === 'ai'     ? 'border-purple-500/20 text-purple-400 bg-purple-500/10' :
                                              'border-blue-500/20 text-blue-400 bg-blue-500/10'
                  }`}>
                    {log.entity}
                  </span>
                </div>
              )
            })}

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-800/20">
              <button
                disabled={page === 0}
                onClick={() => load(page - 1)}
                className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-500">Page {page + 1}</span>
              <button
                disabled={logs.length < PER_PAGE}
                onClick={() => load(page + 1)}
                className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ISO note */}
      <div className="card bg-blue-500/5 border-blue-500/20 text-sm text-slate-400">
        <p>
          <span className="text-blue-400 font-medium">ISO 19650 Aligned.</span>{' '}
          This audit trail records all asset changes, imports, and AI queries with timestamps,
          providing the evidence trail required for information management accountability.
        </p>
      </div>
    </div>
  )
}
