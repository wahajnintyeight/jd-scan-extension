/**
 * User Settings Management
 */

export interface UserSettings {
  displayMode: 'sidebar' | 'overlay';
  colorMode: 'light' | 'dark' | 'auto';
  overlayPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoScan: boolean;
  showNotifications: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayMode: 'overlay',
  colorMode: 'auto',
  overlayPosition: 'bottom-right',
  autoScan: true,
  showNotifications: true,
};

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
