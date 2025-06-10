const CACHE_NAME = 'pio-help-desk-v1.0.0';
const STATIC_CACHE_NAME = 'pio-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'pio-dynamic-v1.0.0';

// Static resources to cache
const STATIC_ASSETS = [
  '/',
  '/portal/dashboard',
  '/portal/tickets',
  '/portal/ticket/new',
  '/portal/knowledge-base',
  '/portal/profile',
  '/manifest.json',
  '/offline.html'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^\/api\/tickets/,
  /^\/api\/knowledge-base/,
  /^\/api\/users\/profile/,
  /^\/api\/announcements/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME && 
              cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (request.url.includes('/api/')) {
    // API requests - Network First with Cache Fallback
    event.respondWith(handleApiRequest(request));
  } else if (request.destination === 'document') {
    // HTML pages - Stale While Revalidate
    event.respondWith(handlePageRequest(request));
  } else {
    // Static assets - Cache First
    event.respondWith(handleStaticRequest(request));
  }
});

// Handle API requests with Network First strategy
async function handleApiRequest(request) {
  const cacheName = DYNAMIC_CACHE_NAME;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    return new Response(
      JSON.stringify({
        error: 'Нема интернет везе',
        message: 'Подаци нису доступни offline',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle page requests with Stale While Revalidate
async function handlePageRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  // Get cached version
  const cachedResponse = await cache.match(request);
  
  // Fetch fresh version in background
  const networkResponsePromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    // Network failed, return cached version or offline page
    return cachedResponse || caches.match('/offline.html');
  });
  
  // Return cached version immediately, or wait for network
  return cachedResponse || networkResponsePromise;
}

// Handle static assets with Cache First strategy
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);
    
    // Return fallback for images
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f5f5f5"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#999">Слика није доступна</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    throw error;
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'PIO Help Desk',
    body: 'Имате ново обавештење',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'pio-notification',
    requireInteraction: false
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        actions: [
          {
            action: 'view',
            title: 'Прикажи',
            icon: '/icons/action-view.png'
          },
          {
            action: 'dismiss',
            title: 'Одбаци',
            icon: '/icons/action-dismiss.png'
          }
        ]
      };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app to relevant page
    event.waitUntil(
      clients.openWindow('/portal/dashboard')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes('/portal') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow('/portal/dashboard');
        }
      })
    );
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-ticket-sync') {
    event.waitUntil(syncTickets());
  }
});

// Sync offline ticket submissions
async function syncTickets() {
  try {
    // Get offline ticket submissions from IndexedDB
    const offlineTickets = await getOfflineTickets();
    
    for (const ticket of offlineTickets) {
      try {
        const response = await fetch('/api/tickets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ticket.data)
        });
        
        if (response.ok) {
          // Remove from offline storage
          await removeOfflineTicket(ticket.id);
          console.log('[SW] Offline ticket synced:', ticket.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync ticket:', ticket.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Helper functions for offline storage (would integrate with IndexedDB)
async function getOfflineTickets() {
  // This would integrate with IndexedDB to get offline tickets
  return [];
}

async function removeOfflineTicket(id) {
  // This would remove the ticket from IndexedDB
  console.log('Removing offline ticket:', id);
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
}); 