import { Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Book from './pages/Book'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/book" element={<Book />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
