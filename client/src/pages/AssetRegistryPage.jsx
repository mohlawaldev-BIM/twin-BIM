import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../components/Auth/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Search, Filter, Plus, Pencil, Trash2, X, Loader2,
  Database, CheckSquare, Square, AlertTriangle,
  Wrench, CheckCircle2, Archive, ClipboardEdit, Tag
} from 'lucide-react'
import { Link } from 'react-router-dom'

const STATUSES   = ['operational', 'maintenance', 'critical', 'decommissioned']
const CATEGORIES = ['HVAC', 'Electrical', 'Plumbing', 'Structural', 'Fire Safety', 'Lift / Elevator', 'Facade', 'Fitout', 'ICT', 'Other']

const STATUS_META = {
  operational:    { badge: 'bg-green-500/10 text-green-400 border-green-500/20',  icon: CheckCircle2,  label: 'Operational'    },
  maintenance:    { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  icon: Wrench,        label: 'Maintenance'    },
  critical:       { badge: 'bg-red-500/10   text-red-400   border-red-500/20',    icon: AlertTriangle, label: 'Critical'       },
  decommissioned: { badge: 'bg-slate-700    text-slate-400 border-slate-600',     icon: Archive,       label: 'Decommissioned' },
}

const EMPTY = { name: '', category: 'HVAC', location: '', status: 'operational', manufacturer: '', model_number: '', install_date: '', warranty_expiry: '', notes: '' }

function computeSmartStatus(asset) {
  const today       = new Date()
  const warrantyExp = asset.warranty_expiry ? new Date(asset.warranty_expiry) : null
  if (!warrantyExp) return null
  if (warrantyExp < new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())) return 'critical'
  if (warrantyExp < new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())) return 'maintenance'
  return 'operational'
}

export default function AssetRegistryPage() {
  const { user } = useAuth()
  const [assets,      setAssets]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [statusFilter,setStatusFilter]= useState('all')
  const [catFilter,   setCatFilter]   = useState('all')
  const [selected,    setSelected]    = useState(new Set())
  const [bulkModal,   setBulkModal]   = useState(false)
  const [bulkStatus,  setBulkStatus]  = useState('operational')
  const [bulkReason,  setBulkReason]  = useState('')
  const [bulkSaving,  setBulkSaving]  = useState(false)
  const [modal,       setModal]       = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [form,        setForm]        = useState(EMPTY)
  const [saving,      setSaving]      = useState(false)

  const load = async () => {
    setLoading(true)
    const PAGE = 1000
    let all = [], page = 0, done = false
    while (!done) {
      const { data, error } = await supabase
        .from('assets').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE, (page + 1) * PAGE - 1)
      if (error || !data || data.length === 0) { done = true; break }
      all = [...all, ...data]
      if (data.length < PAGE) done = true
      else page++
    }
    setAssets(all)
    setSelected(new Set())
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  const visible = useMemo(() => assets.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) ||
      (a.location || '').toLowerCase().includes(q) || (a.manufacturer || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const matchCat    = catFilter    === 'all' || a.category === catFilter
    return matchSearch && matchStatus && matchCat
  }), [assets, search, statusFilter, catFilter])

  const stats = useMemo(() => {
    const s = { operational: 0, maintenance: 0, critical: 0, decommissioned: 0 }
    assets.forEach(a => { if (s[a.status] !== undefined) s[a.status]++ })
    return s
  }, [assets])

  const allVisibleSelected = visible.length > 0 && visible.every(a => selected.has(a.id))
  const someSelected       = selected.size > 0

  const toggleOne = id =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected(prev => { const n = new Set(prev); visible.forEach(a => n.delete(a.id)); return n })
    } else {
      setSelected(prev => { const n = new Set(prev); visible.forEach(a => n.add(a.id)); return n })
    }
  }

  const clearSelection = () => setSelected(new Set())

  const logAudit = (action, entity = 'asset') =>
    supabase.from('audit_log').insert({ user_id: user.id, action, entity })

  const doBulkUpdate = async () => {
    if (!selected.size) return
    setBulkSaving(true)
    const ids    = [...selected]
    const now    = new Date().toISOString()
    const reason = bulkReason.trim()
    const CHUNK  = 100
    for (let i = 0; i < ids.length; i += CHUNK) {
      const patch = { status: bulkStatus, last_updated: now }
      if (reason) patch.notes = `[${new Date().toLocaleDateString()}] Status → ${STATUS_META[bulkStatus].label}. Reason: ${reason}`
      await supabase.from('assets').update(patch).in('id', ids.slice(i, i + CHUNK))
    }
    await logAudit(
      `Bulk status update: ${ids.length} asset(s) → ${STATUS_META[bulkStatus].label}${reason ? `. Reason: ${reason}` : ''}`,
      'asset'
    )
    setBulkSaving(false); setBulkModal(false); setBulkReason('')
    clearSelection(); load()
  }

  const openAdd    = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit   = a  => { setForm(a); setEditing(a.id); setModal(true) }
  const closeModal = () => { setModal(false); setEditing(null); setForm(EMPTY) }

  const save = async () => {
    setSaving(true)
    const smart = computeSmartStatus(form)
    const payload = { ...form, status: smart || form.status, user_id: user.id, last_updated: new Date().toISOString() }
    if (editing) {
      await supabase.from('assets').update(payload).eq('id', editing)
      await logAudit(`Updated asset: ${form.name} → ${payload.status}`)
    } else {
      await supabase.from('assets').insert(payload)
      await logAudit(`Added asset: ${form.name}`)
    }
    setSaving(false); closeModal(); load()
  }

  const remove = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('assets').delete().eq('id', id)
    await logAudit(`Deleted asset: ${name}`)
    load()
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Asset Registry</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {assets.length.toLocaleString()} assets in your digital twin
            {someSelected && <span className="ml-2 text-blue-400">· {selected.size.toLocaleString()} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {someSelected && (
            <>
              <button onClick={clearSelection} className="btn-secondary text-sm flex items-center gap-1.5">
                <X size={14} /> Deselect
              </button>
              <button
                onClick={() => { setBulkStatus('operational'); setBulkModal(true) }}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <ClipboardEdit size={14} /> Update {selected.size} Asset{selected.size > 1 ? 's' : ''}
              </button>
            </>
          )}
          <button onClick={openAdd} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={15} /> Add Asset
          </button>
        </div>
      </div>

      {/* Status stats bar — clickable filters */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUSES.map(s => {
            const { badge, icon: Icon, label } = STATUS_META[s]
            const isActive = statusFilter === s
            const bgClass  = badge.split(' ')[0]
            const txtClass = badge.split(' ')[1]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(isActive ? 'all' : s)}
                className={`card flex items-center gap-3 text-left transition-all duration-150 hover:border-slate-600 ${isActive ? 'border-blue-500/50 bg-blue-500/5' : ''}`}
              >
                <div className={`p-2 rounded-lg ${bgClass}`}>
                  <Icon size={14} className={txtClass} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">{stats[s].toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, category, location, manufacturer…" className="input pl-10" />
        </div>
        <div className="relative">
          <Tag size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="input pl-10 pr-8 appearance-none cursor-pointer min-w-[160px]">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="input pl-10 pr-8 appearance-none cursor-pointer min-w-[160px]">
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      </div>

      {/* Selection info bar */}
      {someSelected && (
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-300">
            <span className="font-semibold">{selected.size.toLocaleString()}</span> asset{selected.size > 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-3">
            <button onClick={() => setSelected(new Set(visible.map(a => a.id)))}
              className="text-xs text-blue-400 hover:text-blue-300 underline">
              Select all {visible.length.toLocaleString()} visible
            </button>
            <button onClick={clearSelection} className="text-xs text-blue-400 hover:text-blue-300 underline">Clear</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-blue-400" />
          <p className="text-sm text-slate-400">Loading assets…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card text-center py-16">
          <Database size={40} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400">
            {assets.length === 0
              ? <span>No assets yet. <Link to="/upload" className="text-blue-400">Import BIM data</Link> or add one manually.</span>
              : 'No assets match your current filters.'}
          </p>
          {assets.length > 0 && (
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setCatFilter('all') }}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAllVisible} className="text-slate-400 hover:text-white transition-colors">
                      {allVisibleSelected
                        ? <CheckSquare size={16} className="text-blue-400" />
                        : <Square size={16} />}
                    </button>
                  </th>
                  {['Asset Name', 'Category', 'Location', 'Status', 'Manufacturer', 'Last Updated', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((a, i) => {
                  const isSelected = selected.has(a.id)
                  return (
                    <tr key={a.id} onClick={() => toggleOne(a.id)}
                      className={`border-b border-slate-800/60 transition-colors cursor-pointer
                        ${isSelected ? 'bg-blue-500/5' : i % 2 === 0 ? 'hover:bg-slate-800/30' : 'bg-slate-800/10 hover:bg-slate-800/30'}`}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleOne(a.id)} className="text-slate-400 hover:text-white">
                          {isSelected ? <CheckSquare size={15} className="text-blue-400" /> : <Square size={15} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">{a.name}</td>
                      <td className="px-4 py-3 text-slate-400">{a.category}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{a.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                          ${STATUS_META[a.status]?.badge || STATUS_META.decommissioned.badge}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{a.manufacturer || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {a.last_updated ? new Date(a.last_updated).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(a)} className="text-slate-500 hover:text-blue-400 transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => remove(a.id, a.name)} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-800/20 flex items-center justify-between">
            <p className="text-xs text-slate-500">Showing {visible.length.toLocaleString()} of {assets.length.toLocaleString()} assets</p>
            {someSelected && (
              <button onClick={() => { setBulkStatus('operational'); setBulkModal(true) }}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <ClipboardEdit size={12} /> Update {selected.size} selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Status Update Modal */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ClipboardEdit size={16} className="text-blue-400" />
                Update {selected.size.toLocaleString()} Asset{selected.size > 1 ? 's' : ''}
              </h3>
              <button onClick={() => setBulkModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="label">New Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => {
                    const { badge, icon: Icon, label } = STATUS_META[s]
                    const isActive = bulkStatus === s
                    return (
                      <button key={s} onClick={() => setBulkStatus(s)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
                          ${isActive ? `${badge} border-current` : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        <Icon size={14} /> {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="label">
                  Reason <span className="text-slate-600 font-normal">(optional but recommended)</span>
                </label>
                <textarea value={bulkReason} onChange={e => setBulkReason(e.target.value)}
                  placeholder={
                    bulkStatus === 'maintenance'    ? 'e.g. Scheduled Q2 maintenance cycle' :
                    bulkStatus === 'critical'       ? 'e.g. Physical inspection found fault — 13 May 2026' :
                    bulkStatus === 'decommissioned' ? 'e.g. Equipment removed during Level 2 refurbishment' :
                    'e.g. Post-inspection confirmed all units operational'
                  }
                  rows={3} className="input resize-none" />
                <p className="text-xs text-slate-600 mt-1.5">
                  Saved to each asset's notes and logged in the Audit Trail.
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl px-4 py-3 text-sm text-slate-400">
                Marking <span className="text-white font-semibold">{selected.size.toLocaleString()} asset{selected.size > 1 ? 's' : ''}</span> as{' '}
                <span className={`font-semibold ${STATUS_META[bulkStatus].badge.split(' ').find(c => c.startsWith('text-'))}`}>
                  {STATUS_META[bulkStatus].label}
                </span>. This will be recorded in the Audit Trail.
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setBulkModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={doBulkUpdate} disabled={bulkSaving}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {bulkSaving ? <Loader2 size={15} className="animate-spin" /> : <ClipboardEdit size={15} />}
                {bulkSaving ? 'Updating…' : `Update ${selected.size.toLocaleString()} Asset${selected.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">{editing ? 'Edit Asset' : 'Add New Asset'}</h3>
              <button onClick={closeModal} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'name',            label: 'Asset Name *',     type: 'text' },
                { key: 'location',        label: 'Location / Space', type: 'text' },
                { key: 'manufacturer',    label: 'Manufacturer',     type: 'text' },
                { key: 'model_number',    label: 'Model Number',     type: 'text' },
                { key: 'install_date',    label: 'Install Date',     type: 'date' },
                { key: 'warranty_expiry', label: 'Warranty Expiry',  type: 'date' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="input" />
                </div>
              ))}
              <div>
                <label className="label">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => {
                    const { badge, icon: Icon, label } = STATUS_META[s]
                    const isActive = form.status === s
                    return (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all
                          ${isActive ? `${badge} border-current` : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        <Icon size={13} /> {label}
                      </button>
                    )
                  })}
                </div>
                {/* Smart status hint */}
                {(() => {
                  const smart = computeSmartStatus(form)
                  return smart && smart !== form.status ? (
                    <p className="text-xs text-amber-400 mt-2">
                      💡 Based on dates entered, smart status suggests: <strong>{STATUS_META[smart].label}</strong>
                    </p>
                  ) : null
                })()}
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} className="input resize-none" placeholder="Inspection notes, maintenance history…" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={!form.name || saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
