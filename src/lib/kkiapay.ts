export type KkiapayWidgetOptions = {
  amount: number
  key: string
  partnerId: string
  position: 'center'
  theme: string
  sandbox: boolean
  email?: string
  name?: string
  phone?: string
}

export type KkiapayWidgetResult = {
  transactionId?: unknown
  transaction_id?: unknown
}

declare global {
  interface Window {
    openKkiapayWidget?: (options: KkiapayWidgetOptions) => void
    addSuccessListener?: (listener: (result: KkiapayWidgetResult) => void) => void
    removeSuccessListener?: (listener: (result: KkiapayWidgetResult) => void) => void
    addFailedListener?: (listener: (error: unknown) => void) => void
    removeFailedListener?: (listener: (error: unknown) => void) => void
  }
}

let sdkPromise: Promise<void> | null = null

export function loadKkiapaySdk(): Promise<void> {
  if (window.openKkiapayWidget) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.kkiapay.me/k.js'
    script.async = true
    script.onload = () => {
      if (window.openKkiapayWidget && window.addSuccessListener && window.addFailedListener) {
        resolve()
      } else {
        sdkPromise = null
        script.remove()
        reject(new Error('Le module de paiement KKiaPay ne s’est pas initialisé correctement.'))
      }
    }
    script.onerror = () => {
      sdkPromise = null
      script.remove()
      reject(new Error('Impossible de charger le module de paiement KKiaPay. Vérifiez votre connexion puis réessayez.'))
    }
    document.body.appendChild(script)
  })

  return sdkPromise
}
