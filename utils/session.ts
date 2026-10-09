/**
 * Session Management Utility
 * Handles session creation, storage, and validation
 */

import { API_BASE_URL, apiFetch } from './apiTransport';

const SESSION_STORAGE_KEY = 'jd_scan_session';
const SESSION_EXPIRY_HOURS = 1;

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
    const response = await apiFetch(`${API_BASE_URL}/createSession`, {
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
 * Get stored session data from extension storage, isolated from host websites.
 */
async function getStoredSession(): Promise<SessionData | null> {
  try {
    const data = await chrome.storage.local.get(SESSION_STORAGE_KEY);
    const session = data[SESSION_STORAGE_KEY] as SessionData | undefined;
    if (!session || typeof session.sessionId !== 'string' || !Number.isFinite(session.expiresAt) || Date.now() > session.expiresAt) {
      if (session) await chrome.storage.local.remove(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Error reading stored session:', error);
    return null;
  }
}

/**
 * Store session data in extension storage.
 */
async function storeSession(sessionId: string): Promise<void> {
  const now = Date.now();
  const sessionData: SessionData = {
    sessionId,
    createdAt: now,
    expiresAt: now + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000),
  };
  
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: sessionData });
}

/**
 * Get valid session ID (creates new one if needed)
 */
export async function getSessionId(): Promise<string | null> {
  // Check for existing valid session
  const stored = await getStoredSession();
  if (stored) {
    return stored.sessionId;
  }
  
  // Create new session
  const sessionId = await createSession();
  if (sessionId) {
    await storeSession(sessionId);
    return sessionId;
  }
  
  return null;
}

/**
 * Clear stored session (logout)
 */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_STORAGE_KEY);
}

/**
 * Check if session is valid
 */
export async function hasValidSession(): Promise<boolean> {
  return (await getStoredSession()) !== null;
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
