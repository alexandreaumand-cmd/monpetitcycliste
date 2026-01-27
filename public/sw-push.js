// Service Worker for Push Notifications
// This file is imported by the main service worker via workbox importScripts

self.addEventListener('push', function(event) {
  console.log('[SW Push] Push event received');
  
  if (!event.data) {
    console.log('[SW Push] No data in push event');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW Push] Failed to parse push data:', e);
    return;
  }

  const { title, message, type, metadata } = data;

  const options = {
    body: message || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
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
    self.registration.showNotification(title || 'Mon Petit Cycliste', options)
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
      return `${baseUrl}/resultats`;
    
    case 'startlist_validated':
      return `${baseUrl}/startlist`;
    
    case 'auction_opened':
    case 'auction_closed':
    case 'auction_ready_to_close':
    case 'auction_validation':
      if (metadata?.league_id) {
        return `${baseUrl}/encheres?leagueId=${metadata.league_id}`;
      }
      return `${baseUrl}/encheres`;
    
    default:
      return baseUrl;
  }
}
