import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api`;

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('m4f_session');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('m4f_session', sessionId);
  }
  return sessionId;
};

// Track event function
export const trackEvent = async (
  eventType: string,
  eventName: string,
  properties?: Record<string, unknown>
) => {
  try {
    await fetch(`${API_BASE}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        event_type: eventType,
        event_name: eventName,
        properties,
        session_id: getSessionId(),
      }),
    });
  } catch (err) {
    // Silently fail - analytics shouldn't break the app
    console.debug('Analytics track failed:', err);
  }
};

// Track page view
export const trackPageView = (path: string) => {
  trackEvent('page_view', path);
};

// Track feature usage
export const trackFeature = (featureName: string, properties?: Record<string, unknown>) => {
  trackEvent('feature_use', featureName, properties);
};

// Track click
export const trackClick = (elementName: string, properties?: Record<string, unknown>) => {
  trackEvent('click', elementName, properties);
};

// Hook to automatically track page views
export function usePageTracking() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    // Only track if path changed (not on initial mount for the same path)
    if (previousPath.current !== location.pathname) {
      trackPageView(location.pathname);
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
}

// Export hook for manual analytics
export function useAnalytics() {
  return {
    trackEvent,
    trackPageView,
    trackFeature,
    trackClick,
  };
}

export default useAnalytics;
