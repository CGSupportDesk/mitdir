import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Book from './pages/Book'
import Login from './pages/Login'
import Register from './pages/Register'
import PortalDashboard from './pages/PortalDashboard'
import ModulePage from './pages/ModulePage'
import Settings from './pages/Settings'
import RequestConfirmed from './pages/RequestConfirmed'
import PlatformModule from './pages/PlatformModule'
import LiveJourney from './pages/LiveJourney'
import Messages from './pages/Messages'
import Accessibility from './pages/Accessibility'
import AiStudio from './pages/AiStudio'
import Matching from './pages/Matching'
import Reports from './pages/Reports'
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
        <Route path="live-journey" element={<LiveJourney />} />
        <Route path="messages" element={<Messages />} />
        <Route path="accessibility" element={<Accessibility />} />
        <Route path="ai" element={<AiStudio />} />
        <Route path="matching" element={<Matching />} />
        <Route path="reports" element={<Reports />} />
        <Route path="care-circle" element={<PlatformModule />} />
        <Route path="availability" element={<PlatformModule />} />
        <Route path="safety" element={<PlatformModule />} />
        <Route path="documents" element={<PlatformModule />} />
        <Route path="consents" element={<PlatformModule />} />
        <Route path="medication" element={<PlatformModule />} />
        <Route path="recurring" element={<PlatformModule />} />
        <Route path="onboarding" element={<PlatformModule />} />
        <Route path="shifts" element={<PlatformModule />} />
        <Route path="service-areas" element={<PlatformModule />} />
        <Route path="pricing" element={<PlatformModule />} />
        <Route path="promotions" element={<PlatformModule />} />
        <Route path="memberships" element={<PlatformModule />} />
        <Route path="invoices" element={<PlatformModule />} />
        <Route path="ratings" element={<PlatformModule />} />
        <Route path="communications" element={<PlatformModule />} />
        <Route path="integrations" element={<PlatformModule />} />
        <Route path=":module" element={<ModulePage />} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
