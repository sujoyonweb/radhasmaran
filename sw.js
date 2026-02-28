// RadhaSmaran Dual-Tier PWA Engine v1.0.0

// APP_CACHE updates frequently (HTML, CSS, JS)
const APP_CACHE = 'radhasmaran-app-v1.0.0'; 
// CORE_CACHE updates rarely (Fonts, Icons, Audio, Images)
const CORE_CACHE = 'radhasmaran-core-v1.0.0';   

// Lightweight files that power the app logic
const APP_FILES = [
  './',
  './index.html',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/animations.css',
  './js/app.js',
  './js/state.js',
  './js/stats.js',
  './js/storage.js',
  './js/ui.js'
];

// Heavy files that stay permanently frozen on the user's device
const CORE_FILES = [
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/fonts/inter-v20-latin-regular.woff2',
  './assets/fonts/inter-v20-latin-500.woff2',
  './assets/fonts/inter-v20-latin-600.woff2',
  './assets/fonts/jetbrains-mono-v24-latin-regular.woff2',
  './assets/fonts/jetbrains-mono-v24-latin-500.woff2',
  './assets/fonts/jetbrains-mono-v24-latin-700.woff2'
];

// 1. INSTALLATION: Cache both tiers simultaneously
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(APP_CACHE).then(cache => cache.addAll(APP_FILES)),
      caches.open(CORE_CACHE).then(cache => cache.addAll(CORE_FILES))
    ])
  );
});

// 2. ACTIVATION: Surgical Garbage Collection
self.addEventListener('activate', (event) => {
  const allowedCaches = [APP_CACHE, CORE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Only delete caches that are NOT in our allowed list
          if (!allowedCaches.includes(cache)) {
            console.log('[RadhaSmaran SW] Purging old cache:', cache);
            return caches.delete(cache); 
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Smart Network Engine (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
  // Ignore external requests (like analytics) and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          // Smart Sorting: Put fonts/assets into CORE, put code/HTML into APP
          const targetCache = event.request.url.includes('/assets/') ? CORE_CACHE : APP_CACHE;
          const responseToCache = networkResponse.clone();
          
          caches.open(targetCache).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        console.log('[RadhaSmaran SW] Serving purely from offline cache.');
      });

      // Instantly return the cached version if we have it, while updating in the background
      return cachedResponse || fetchPromise;
    })
  );
});