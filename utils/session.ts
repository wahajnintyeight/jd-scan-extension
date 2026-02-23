/**
 * Session Management Utility
 * Handles session creation, storage, and validation
 */

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  // Try to get from import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Fallback to default
  return 'http://localhost:8881/v2/api';
};

const API_BASE_URL = getApiBaseUrl();
const SESSION_STORAGE_KEY = 'jd_scan_session';
const SESSION_EXPIRY_HOURS = 1;

// Debug log to verify API URL is set correctly
console.log('[Session] Base URL:', API_BASE_URL);

interface SessionData {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Create a new session with the backend
 */
async function createSession(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/createSession`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    
    // Handle both response formats:
    // 1. code: 1007 with result as string (current backend)
    // 2. code: 1022 with result.sessionId (legacy format)
    if (data.code === 1007 && typeof data.result === 'string') {
      return data.result;
    }
    
    if (data.code === 1022 && data.result?.sessionId) {
      return data.result.sessionId;
    }
    
    console.error('Failed to create session:', data);
    return null;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

/**
 * Get stored session data from localStorage
 */
function getStoredSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    
    const session: SessionData = JSON.parse(stored);
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error reading stored session:', error);
    return null;
  }
}

/**
 * Store session data in localStorage
 */
function storeSession(sessionId: string): void {
  const now = Date.now();
  const sessionData: SessionData = {
    sessionId,
    createdAt: now,
    expiresAt: now + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000),
  };
  
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

/**
 * Get valid session ID (creates new one if needed)
 */
export async function getSessionId(): Promise<string | null> {
  // Check for existing valid session
  const stored = getStoredSession();
  if (stored) {
    return stored.sessionId;
  }
  
  // Create new session
  const sessionId = await createSession();
  if (sessionId) {
    storeSession(sessionId);
    return sessionId;
  }
  
  return null;
}

/**
 * Clear stored session (logout)
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Check if session is valid
 */
export function hasValidSession(): boolean {
  return getStoredSession() !== null;
}

/**
 * Get session headers for API requests
 */
export async function getSessionHeaders(): Promise<Record<string, string>> {
  const sessionId = await getSessionId();
  
  if (!sessionId) {
    throw new Error('Failed to obtain session ID');
  }
  
  return {
    'Content-Type': 'application/json',
    'sessionId': sessionId,
  };
}
