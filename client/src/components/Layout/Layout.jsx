import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../Auth/AuthContext'
import {
  Building2, LayoutDashboard, Database,
  Upload, Bot, ClipboardList, LogOut,
  Menu, X, ChevronRight
} from 'lucide-react'

const nav = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/assets',     icon: Database,         label: 'Asset Registry' },
  { to: '/upload',     icon: Upload,           label: 'Import Data'    },
  { to: '/ai',         icon: Bot,              label: 'AI Assistant'   },
  { to: '/audit',      icon: ClipboardList,    label: 'Audit Trail'    },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate           = useNavigate()
  const [open, setOpen]    = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        flex flex-col w-64 bg-slate-900 border-r border-slate-800
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30 shrink-0">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">TwinBIM</p>
            <p className="text-slate-500 text-xs mt-0.5">Digital Twin Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group
                 ${isActive
                   ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                   : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  {label}
                  {isActive && <ChevronRight size={14} className="ml-auto text-blue-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/60 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setOpen(true)} className="text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-blue-400" />
            <span className="font-bold text-white text-sm">TwinBIM</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
