import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isAppleMobileDevice() {
  const platform = navigator.platform
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isAppInstalled() {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isIOS] = useState(isAppleMobileDevice)
  const [isStandalone, setIsStandalone] = useState(isAppInstalled)
  const [isDismissed, setIsDismissed] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (isStandalone || isDismissed || (!installPrompt && !isIOS)) return null

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowIOSInstructions((show) => !show)
      return
    }

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <aside className="pwa-install-card" aria-label="Installer FactureFacile">
      <img src="/pwa-192.png" alt="" className="pwa-install-icon" />
      <div className="pwa-install-copy">
        <strong>FactureFacile sur mobile</strong>
        <span>
          {showIOSInstructions
            ? 'Dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».'
            : 'Ajoutez l’application à votre écran d’accueil.'}
        </span>
      </div>
      <button className="pwa-install-action" type="button" onClick={handleInstall}>
        {installPrompt ? <Download size={16} aria-hidden="true" /> : null}
        {installPrompt ? 'Installer' : showIOSInstructions ? 'Compris' : 'Comment faire'}
      </button>
      <button
        className="pwa-install-dismiss"
        type="button"
        aria-label="Fermer le message d’installation"
        onClick={() => setIsDismissed(true)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  )
}