import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// VAPID public key - must match the one in Cloud secrets
const VAPID_PUBLIC_KEY = 'BCfsjfWS47JE_QBAn1vRb72fPsfHbg6DeGYx7M0zZLb8FDj9zG3Ezk24TP6kb_OhJ5EMLzClH1NbayZ2ehMsp7U';

export interface PushPreferences {
  results: boolean;
  startlists: boolean;
  auctions: boolean;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  preferences: PushPreferences;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (newPreferences: Partial<PushPreferences>) => Promise<boolean>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>({
    results: true,
    startlists: true,
    auctions: true
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    };
    
    checkSupport();
  }, []);

  // Load current subscription state from database
  useEffect(() => {
    const loadSubscriptionState = async () => {
      if (!isSupported) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setIsLoading(false);
          return;
        }

        // Check if user has a subscription in database
        const { data: subscription } = await supabase
          .from('push_subscriptions')
          .select('preferences')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (subscription) {
          setIsSubscribed(true);
          if (subscription.preferences) {
            const prefs = subscription.preferences as Record<string, boolean>;
            setPreferences({
              results: prefs.results ?? true,
              startlists: prefs.startlists ?? true,
              auctions: prefs.auctions ?? true
            });
          }
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error loading push subscription state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptionState();
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      
      if (permissionResult !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      const subscriptionJson = pushSubscription.toJSON();
      
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      const prefsAsJson: Json = {
        results: preferences.results,
        startlists: preferences.startlists,
        auctions: preferences.auctions
      };

      // Check if subscription exists
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        // Update existing subscription
        const { error } = await supabase
          .from('push_subscriptions')
          .update({
            endpoint: subscriptionJson.endpoint!,
            p256dh: subscriptionJson.keys?.p256dh || '',
            auth: subscriptionJson.keys?.auth || '',
            preferences: prefsAsJson,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', session.user.id);

        if (error) throw error;
      } else {
        // Insert new subscription
        const { error } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: session.user.id,
            endpoint: subscriptionJson.endpoint!,
            p256dh: subscriptionJson.keys?.p256dh || '',
            auth: subscriptionJson.keys?.auth || '',
            preferences: prefsAsJson
          });

        if (error) throw error;
      }

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, preferences]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      // Remove subscription from database
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', session.user.id);

      if (error) throw error;

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const updatePreferences = useCallback(async (newPreferences: Partial<PushPreferences>): Promise<boolean> => {
    const updatedPreferences = { ...preferences, ...newPreferences };
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('User not authenticated');
      }

      const prefsAsJson: Json = {
        results: updatedPreferences.results,
        startlists: updatedPreferences.startlists,
        auctions: updatedPreferences.auctions
      };

      const { error } = await supabase
        .from('push_subscriptions')
        .update({
          preferences: prefsAsJson,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      setPreferences(updatedPreferences);
      return true;
    } catch (error) {
      console.error('Error updating push preferences:', error);
      return false;
    }
  }, [preferences]);

  return {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    isLoading,
    subscribe,
    unsubscribe,
    updatePreferences
  };
}
