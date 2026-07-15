import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Book from './pages/Book'
import Login from './pages/Login'
import Register from './pages/Register'
import PortalDashboard from './pages/PortalDashboard'
import ModulePage from './pages/ModulePage'
import Settings from './pages/Settings'
import RequestConfirmed from './pages/RequestConfirmed'
import AppLayout from './components/AppLayout'
import { ProtectedRoute } from './lib/auth'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/book" element={<Book />} />
      <Route path="/request-confirmed" element={<RequestConfirmed />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<PortalDashboard />} />
        <Route path="settings" element={<Settings />} />
        <Route path=":module" element={<ModulePage />} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
