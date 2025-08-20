// AFZ Advocacy PWA Service Worker
const CACHE_NAME = 'afz-advocacy-v1.0.6';
const OFFLINE_URL = '/pages/offline.html';

// Assets to cache for offline functionality
const CACHE_URLS = [
    // Main pages
    '/',
    '/index.html',
    '/pages/about.html',
    '/pages/contact.html',
    '/pages/donate.html',
    '/pages/auth.html',
    '/pages/offline.html',

    // CSS files
    '/css/afz-unified-design.css',

    // JavaScript files
    '/js/main.js',
    '/js/language.js',
    '/js/navigation.js',
    '/js/pwa.js',
    '/js/donate.js',
    '/js/auth.js',

    // Translation files
    '/translations/en.json',
    '/translations/fr.json',
    '/translations/es.json',
    '/translations/pt.json',
    '/translations/ny.json',
    '/translations/be.json',
    '/translations/to.json',
    '/translations/lo.json',
    '/translations/sn.json',
    '/translations/nd.json',

    // Images (core assets only)
    '/images/logo.png',
    '/images/hero-bg.jpg',
    '/images/about-hero.jpg',

    // Manifest
    '/manifest.json',

    // External CDN resources (cached with network-first strategy)
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install event - cache essential resources
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
    // First, clear all existing caches
        caches.keys().then(cacheNames => {
            console.log('[Service Worker] Clearing existing caches:', cacheNames);
            return Promise.all(cacheNames.map(name => caches.delete(name)));
        }).then(() => {
            // Then create new cache
            return caches.open(CACHE_NAME);
        }).then(cache => {
            console.log('[Service Worker] Caching essential resources');
            return cache.addAll(CACHE_URLS);
        }).then(() => {
            console.log('[Service Worker] Installation complete');
            // Force immediate activation
            return self.skipWaiting();
        }).catch(error => {
            console.error('[Service Worker] Installation failed:', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                console.log('[Service Worker] Found caches:', cacheNames);
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // DELETE ALL CACHES - no exceptions
                        console.log('[Service Worker] Deleting cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] All caches cleared');
                // Force immediate control
                return self.clients.claim();
            }).then(() => {
                // Notify all clients to reload
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'FORCE_RELOAD',
                            message: 'Service Worker updated - please reload the page'
                        });
                    });
                });
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        handleFetchRequest(event.request)
    );
});

async function handleFetchRequest(request) {
    const url = new URL(request.url);

    try {
    // Handle different types of requests with appropriate strategies

        // API requests - network first with cache fallback
        if (url.pathname.includes('/api/')) {
            return await networkFirstStrategy(request);
        }

        // External CDN resources - stale while revalidate
        if (url.origin !== self.location.origin) {
            return await staleWhileRevalidateStrategy(request);
        }

        // HTML pages - network first with offline fallback
        if (request.headers.get('accept')?.includes('text/html')) {
            return await networkFirstWithOfflineFallback(request);
        }

        // Static assets (CSS, JS, images) - cache first
        if (isStaticAsset(request.url)) {
            return await cacheFirstStrategy(request);
        }

        // Default: network first
        return await networkFirstStrategy(request);

    } catch (error) {
        console.error('[Service Worker] Fetch error:', error);
        return await handleFetchError(request);
    }
}

// Cache first strategy - for static assets
async function cacheFirstStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
    // Return cached version
        return cachedResponse;
    }

    // Fetch from network and cache
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Network request failed:', error);
        throw error;
    }
}

// Network first strategy - for dynamic content
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
    // Fall back to cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        throw error;
    }
}

// Network first with offline fallback - for HTML pages
async function networkFirstWithOfflineFallback(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
    // Try cache first
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Show offline page as last resort
        return await cache.match(OFFLINE_URL) || new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Stale while revalidate strategy - for external resources
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Fetch fresh version in background
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        console.warn('[Service Worker] Background fetch failed:', error);
        return cachedResponse;
    });

    // Return cached version immediately if available, otherwise wait for network
    return cachedResponse || await fetchPromise;
}

// Handle fetch errors
async function handleFetchError(request) {
    const cache = await caches.open(CACHE_NAME);

    // Try to return cached version
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    // For HTML requests, return offline page
    if (request.headers.get('accept')?.includes('text/html')) {
        return await cache.match(OFFLINE_URL) || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }

    // For other requests, return a simple error response
    return new Response('Resource not available offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
    });
}

// Check if URL is for a static asset
function isStaticAsset(url) {
    return /\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)(\?.*)?$/.test(url);
}

// Handle background sync for form submissions
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background sync triggered:', event.tag);

    if (event.tag === 'form-submission') {
        event.waitUntil(handleFormSubmissionSync());
    }

    if (event.tag === 'donation-submission') {
        event.waitUntil(handleDonationSubmissionSync());
    }
});

// Handle form submissions when back online
async function handleFormSubmissionSync() {
    try {
    // Retrieve pending form submissions from IndexedDB
        const pendingSubmissions = await getPendingFormSubmissions();

        for (const submission of pendingSubmissions) {
            try {
                const response = await fetch(submission.url, {
                    method: 'POST',
                    headers: submission.headers,
                    body: submission.body
                });

                if (response.ok) {
                    // Remove successful submission from pending list
                    await removePendingFormSubmission(submission.id);
                    console.log('[Service Worker] Form submission synced successfully');
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync form submission:', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Background sync failed:', error);
    }
}

// Handle donation submissions when back online
async function handleDonationSubmissionSync() {
    try {
        const pendingDonations = await getPendingDonationSubmissions();

        for (const donation of pendingDonations) {
            try {
                const response = await fetch('/api/donations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(donation.data)
                });

                if (response.ok) {
                    await removePendingDonationSubmission(donation.id);
                    console.log('[Service Worker] Donation submission synced successfully');
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync donation:', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Donation sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', event => {
    console.log('[Service Worker] Push notification received');

    const options = {
        body: 'Stay updated with AFZ advocacy efforts and community events.',
        icon: '/images/pwa-icons/icon-192x192.png',
        badge: '/images/pwa-icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            {
                action: 'explore',
                title: 'Explore App',
                icon: '/images/pwa-icons/explore-icon.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/images/pwa-icons/close-icon.png'
            }
        ]
    };

    let title = 'AFZ Advocacy Update';

    if (event.data) {
        const pushData = event.data.json();
        title = pushData.title || title;
        options.body = pushData.body || options.body;
        options.icon = pushData.icon || options.icon;
        options.data = { ...options.data, ...pushData.data };
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification clicked:', event.notification.tag);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Focus existing window or open new one
    event.waitUntil(
        self.clients.matchAll({ type: 'window' })
            .then(clients => {
                // Check if there's already a window open
                for (const client of clients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/');
                }
            })
    );
});

// Utility functions for IndexedDB operations (simplified for demo)
async function getPendingFormSubmissions() {
    // In a real implementation, you'd use IndexedDB to store and retrieve pending submissions
    return [];
}

async function removePendingFormSubmission(id) {
    // Remove from IndexedDB
    console.log('Removing form submission:', id);
}

async function getPendingDonationSubmissions() {
    // In a real implementation, you'd use IndexedDB to store and retrieve pending donations
    return [];
}

async function removePendingDonationSubmission(id) {
    // Remove from IndexedDB
    console.log('Removing donation submission:', id);
}

console.log('[Service Worker] Service worker script loaded');
