// Service Worker for Push Notifications
// This file is imported by the main service worker via workbox importScripts

self.addEventListener('push', function(event) {
  console.log('[SW Push] Push event received at', new Date().toISOString());
  
  if (!event.data) {
    console.log('[SW Push] No data in push event');
    // Show a fallback notification even without data
    event.waitUntil(
      self.registration.showNotification('La Bordure', {
        body: 'Nouvelle notification reçue',
        icon: '/pwa-192x192-v2.png'
      })
    );
    return;
  }

  let data;
  let rawText = '';
  try {
    // Try to get text first for logging
    rawText = event.data.text();
    console.log('[SW Push] Raw payload:', rawText);
    data = JSON.parse(rawText);
  } catch (e) {
    console.error('[SW Push] Failed to parse push data:', e, 'Raw:', rawText);
    // Show fallback notification on parse error
    event.waitUntil(
      self.registration.showNotification('La Bordure', {
        body: rawText || 'Notification reçue (format inconnu)',
        icon: '/pwa-192x192-v2.png'
      })
    );
    return;
  }

  console.log('[SW Push] Parsed data:', JSON.stringify(data));
  const { title, message, type, metadata } = data;

  const options = {
    body: message || '',
    icon: '/pwa-192x192-v2.png',
    badge: '/notification-badge-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      type: type || 'general',
      metadata: metadata || {},
      url: getUrlForNotificationType(type, metadata)
    },
    actions: [
      {
        action: 'open',
        title: 'Voir'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ],
    requireInteraction: false,
    tag: type || 'mpc-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title || 'La Bordure', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW Push] Notification click received');
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

function getUrlForNotificationType(type, metadata) {
  const baseUrl = '/dashboard';
  
  switch (type) {
    case 'results_added':
      if (metadata?.course_id) {
        const params = new URLSearchParams();
        if (metadata.league_id) params.set('leagueId', metadata.league_id);
        params.set('courseId', metadata.course_id);
        return `${baseUrl}/resultats?${params.toString()}`;
      }
      return `${baseUrl}/resultats`;
    
    case 'startlist_validated':
      if (metadata?.startlist_id) {
        const params = new URLSearchParams();
        if (metadata.league_id) params.set('leagueId', metadata.league_id);
        params.set('startlistId', metadata.startlist_id);
        return `${baseUrl}/startlist?${params.toString()}`;
      }
      return `${baseUrl}/startlist`;
    
    case 'auction_opened':
    case 'auction_closed':
    case 'auction_ready_to_close':
    case 'auction_validation':
      if (metadata?.league_id) {
        return `${baseUrl}/encheres?leagueId=${metadata.league_id}`;
      }
      return `${baseUrl}/encheres`;

    case 'arena_daily_recap':
    case 'arena_weekly_recap':
    case 'arena_mention':
    case 'arena_mention_all':
    case 'arena_reaction': {
      const params = new URLSearchParams();
      params.set('tab', 'trashtalk');
      if (metadata?.league_id) params.set('leagueId', metadata.league_id);
      return `${baseUrl}/arene?${params.toString()}`;
    }
    
    default:
      return baseUrl;
  }
}
