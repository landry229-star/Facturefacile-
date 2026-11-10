const isLocalDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

if (isLocalDev) {
  self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request))
  })
} else {
const CACHE_NAME = 'facturefacile-shell-v4'
const OFFLINE_URL = '/offline.html'
const APP_SHELL = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/favicon.svg',
  '/manifest.webmanifest',
  '/image_8af825cc.jpg',
  '/pwa-180.png',
  '/pwa-192.png',
  '/pwa-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('facturefacile-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return
  const isNavigation = event.request.mode === 'navigate'
  event.respondWith(
    (isNavigation ? fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
      }
      return response
    }) : caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (response.ok && requestUrl.pathname !== '/sw.js') {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
      }
      return response
    }))    ).catch(() => {
      if (!isNavigation) return Response.error()
      return caches.match(event.request).then((cached) => {
        if (cached) return cached
        return caches.match('/').then((appShell) => appShell ?? caches.match(OFFLINE_URL))
      })
    }),
  )
})
}
