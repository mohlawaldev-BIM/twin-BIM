import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/Auth/AuthContext'
import AuthPage from './components/Auth/AuthPage'
import Layout from './components/Layout/Layout'
import DashboardPage    from './pages/DashboardPage'
import AssetRegistryPage from './pages/AssetRegistryPage'
import UploadPage       from './pages/UploadPage'
import AIAssistantPage  from './pages/AIAssistantPage'
import AuditTrailPage   from './pages/AuditTrailPage'
import { Building2 } from 'lucide-react'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
          <Building2 size={22} className="text-white" />
        </div>
        <p className="text-sm">Loading TwinBIM…</p>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/assets"    element={<AssetRegistryPage />} />
              <Route path="/upload"    element={<UploadPage />} />
              <Route path="/ai"        element={<AIAssistantPage />} />
              <Route path="/audit"     element={<AuditTrailPage />} />
              <Route path="*"          element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
