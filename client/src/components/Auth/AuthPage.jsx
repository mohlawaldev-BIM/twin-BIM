import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Building2, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]       = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({ fullName: '', email: '', password: '' })

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) throw error
      } else {
        const { error } = await signUp(form.email, form.password, form.fullName)
        if (error) throw error
        await signIn(form.email, form.password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">TwinBIM</h1>
          <p className="text-slate-400 mt-1 text-sm">From Model to Living Asset</p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl shadow-black/50">
          <h2 className="text-xl font-semibold text-white mb-6">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 mb-5 text-sm">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handle}
                    placeholder="John Doe"
                    required
                    className="input pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handle}
                  placeholder="you@example.com"
                  required
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handle}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input pl-10"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess('') }}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          BIM Digital Twin Platform · Masters Research Prototype
        </p>
      </div>
    </div>
  )
}
