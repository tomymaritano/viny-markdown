/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

// Unique cache name for this deployment
const CACHE = `viny-cache-${version}`;

// Assets to cache immediately on install
const ASSETS = [
	...build, // the app itself (JS, CSS)
	...files // static files
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => {
				self.skipWaiting();
			})
	);
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) {
					await caches.delete(key);
				}
			}
			self.clients.claim();
		})
	);
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Skip cross-origin requests
	const url = new URL(event.request.url);
	if (url.origin !== location.origin) return;

	// Skip API calls or external resources
	if (url.pathname.startsWith('/api/')) return;

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			// Return cached response if available
			if (cachedResponse) {
				return cachedResponse;
			}

			// Otherwise fetch from network
			return fetch(event.request).then((response) => {
				// Don't cache non-successful responses
				if (!response || response.status !== 200 || response.type !== 'basic') {
					return response;
				}

				// Clone response for caching
				const responseToCache = response.clone();

				caches.open(CACHE).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			});
		})
	);
});

// Handle messages from the app
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
