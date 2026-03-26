const CACHE_VERSION = '2'
const CACHE_NAME = `skolicka-v${CACHE_VERSION}`
const STATIC_CACHE = `skolicka-static-v${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
]

// Instalace — precache hlavní stránky
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Aktivace — vymazat staré cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API volání — network-first, při offline vrátit chybu
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Jsi offline.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Navigace (HTML stránky) — network-first, při offline vrátit cached /
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((r) => r || new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // Statické assety (JS, CSS, fonty, obrázky) — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
    })
  )
})
