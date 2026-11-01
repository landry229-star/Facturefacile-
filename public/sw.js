const CACHE_NAME = 'facturefacile-shell-v3'
const OFFLINE_URL = '/offline.html'
const APP_SHELL = ['/', '/index.html', OFFLINE_URL, '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
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
    }))).catch(() => isNavigation ? caches.match(OFFLINE_URL) : Response.error()),
  )
})
