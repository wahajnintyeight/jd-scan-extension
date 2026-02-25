/**
 * User Settings Management
 */

export interface UserSettings {
  displayMode: 'sidebar' | 'overlay';
  colorMode: 'light' | 'dark' | 'auto';
  overlayPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoScan: boolean;
  showNotifications: boolean;
  selectedLLMConfigId?: string; // ID of the LLM config to use for ATS scanning
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayMode: 'overlay',
  colorMode: 'auto',
  overlayPosition: 'bottom-right',
  autoScan: true,
  showNotifications: true,
  selectedLLMConfigId: undefined,
};

/**
 * Persistent state for color mode listener to avoid duplication
 */
let mqlListener: ((event: MediaQueryListEvent) => void) | null = null;
let currentMql: MediaQueryList | null = null;

/**
 * Apply the given color mode to the current document by toggling the `dark` class.
 * - "light": always remove `dark`
 * - "dark": always add `dark`
 * - "auto": follow system preference via prefers-color-scheme
 */
export function applyColorMode(colorMode: UserSettings['colorMode']) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Cleanup old listener if it exists
  if (currentMql && mqlListener) {
    if (typeof currentMql.removeEventListener === 'function') {
      currentMql.removeEventListener('change', mqlListener);
    } else if (typeof (currentMql as any).removeListener === 'function') {
      (currentMql as any).removeListener(mqlListener);
    }
    mqlListener = null;
    currentMql = null;
  }

  const setFromPreference = () => {
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  };

  if (colorMode === 'light') {
    root.classList.remove('dark');
  } else if (colorMode === 'dark') {
    root.classList.add('dark');
  } else {
    setFromPreference();

    // Keep following system changes while in "auto"
    const mql = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
      
    if (mql) {
      currentMql = mql;
      mqlListener = (event: MediaQueryListEvent) => {
        root.classList.toggle('dark', event.matches);
      };
      
      // Use addEventListener when available, fallback otherwise
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', mqlListener);
      } else if (typeof (mql as any).addListener === 'function') {
        (mql as any).addListener(mqlListener);
      }
    }
  }
}


/**
 * Load user settings from storage
 */
export async function loadSettings(): Promise<UserSettings> {
  return new Promise((resolve) => {
    chrome.storage?.local?.get('userSettings', (data) => {
      resolve({ ...DEFAULT_SETTINGS, ...(data?.userSettings || {}) });
    });
  });
}

/**
 * Save user settings to storage
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage?.local?.get('userSettings', (data) => {
      const updated = { ...DEFAULT_SETTINGS, ...(data?.userSettings || {}), ...settings };
      chrome.storage?.local?.set({ userSettings: updated }, () => {
        // Broadcast settings change to all tabs
        chrome.tabs?.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: updated,
              }).catch(() => {
                // Ignore errors for tabs that don't have content script
              });
            }
          });
        });
        resolve();
      });
    });
  });
}

/**
 * Get a specific setting
 */
export async function getSetting<K extends keyof UserSettings>(
  key: K
): Promise<UserSettings[K]> {
  const settings = await loadSettings();
  return settings[key];
}
