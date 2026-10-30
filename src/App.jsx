import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { AdminPage } from './pages/AdminPage'
import { LivePage } from './pages/LivePage'
import { DEFAULT_ROOM } from './lib/constants'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<Navigate to={`/admin/${DEFAULT_ROOM}`} replace />} />
      <Route path="/admin/:roomId" element={<AdminPage />} />
      <Route path="/live" element={<Navigate to={`/live/${DEFAULT_ROOM}`} replace />} />
      <Route path="/live/:roomId/p/:pin" element={<LivePage />} />
      <Route path="/live/:roomId" element={<LivePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
