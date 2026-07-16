import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import './styles.css'

try{
  const p=JSON.parse(localStorage.getItem('mitdir-accessibility')||'null')
  if(p){document.documentElement.classList.toggle('elder-mode',Boolean(p.elderMode));document.documentElement.classList.toggle('high-contrast',Boolean(p.highContrast));document.documentElement.classList.toggle('reduced-motion',Boolean(p.reducedMotion));document.documentElement.style.setProperty('--user-font-scale',String(p.fontScale||1))}
}catch{/* Ignore malformed browser preferences. */}

if('serviceWorker' in navigator)window.addEventListener('load',()=>void navigator.serviceWorker.register('/sw.js'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
