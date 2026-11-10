import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PwaInstallPrompt from './PwaInstallPrompt.tsx'

if ('serviceWorker' in navigator) {
  const isLocalDevHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (import.meta.env.PROD && !isLocalDevHost) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Impossible d’enregistrer le service worker.', error)
      })
    })
  } else if (isLocalDevHost) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => undefined)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaInstallPrompt />
  </StrictMode>,
)
