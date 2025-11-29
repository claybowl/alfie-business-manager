/**
 * Network Status Detection
 * Detects whether the local backend server is available
 */

const BACKEND_HEALTH_CHECK_URL = 'http://localhost:3002/health';
const HEALTH_CHECK_TIMEOUT = 2000; // 2 seconds
let lastHealthStatus: boolean | null = null;
let lastHealthCheckTime = 0;
const HEALTH_CHECK_CACHE_DURATION = 5000; // Cache health check for 5 seconds

/**
 * Check if the backend server is reachable
 * Uses caching to avoid hammering the server with requests
 */
export async function isBackendAvailable(): Promise<boolean> {
  const now = Date.now();

  // Return cached result if still valid
  if (lastHealthStatus !== null && (now - lastHealthCheckTime) < HEALTH_CHECK_CACHE_DURATION) {
    return lastHealthStatus;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(BACKEND_HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    lastHealthStatus = response.ok;
    lastHealthCheckTime = now;
    return response.ok;
  } catch (error) {
    lastHealthStatus = false;
    lastHealthCheckTime = now;
    return false;
  }
}

/**
 * Force a new health check (bypass cache)
 */
export async function forceHealthCheck(): Promise<boolean> {
  lastHealthStatus = null;
  lastHealthCheckTime = 0;
  return isBackendAvailable();
}

/**
 * Subscribe to backend availability changes
 * Useful for UI components that need to know when going online/offline
 */
let listeners: Array<(available: boolean) => void> = [];

export function onBackendStatusChange(callback: (available: boolean) => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * Notify all listeners of status change
 */
async function notifyStatusChange() {
  const status = await forceHealthCheck();
  listeners.forEach(listener => listener(status));
}

/**
 * Start monitoring backend health at regular intervals
 * Returns unsubscribe function
 */
export function startHealthMonitoring(intervalMs: number = 10000): () => void {
  const intervalId = setInterval(notifyStatusChange, intervalMs);
  return () => clearInterval(intervalId);
}

/**
 * Get the last known health status without making a new request
 */
export function getLastKnownStatus(): boolean | null {
  return lastHealthStatus;
}

/**
 * Get time since last health check in milliseconds
 */
export function getTimeSinceLastCheck(): number {
  return Date.now() - lastHealthCheckTime;
}
