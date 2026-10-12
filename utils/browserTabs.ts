import { browser } from 'wxt/browser';

type ActiveTab = Pick<chrome.tabs.Tab, 'id' | 'url'> & { id: number };

export const PAGE_MESSAGE_TYPES = new Set([
  'GET_APPLICATION_FIELDS',
  'OPEN_APPLICATION_FORM',
  'FILL_APPLICATION_FIELDS',
  'FILL_APPLICATION_FIELD',
  'ADVANCE_APPLICATION_STEP',
  'GET_JD',
  'SCAN_PAGE',
  'FORCE_SHOW_BUTTON',
  'HIGHLIGHT_KEYWORDS',
  'REMOVE_HIGHLIGHTS',
]);

async function sendToBackground(request: Record<string, unknown>) {
  if (typeof browser?.runtime?.sendMessage !== 'function') {
    throw new Error('JD Scan cannot access browser tabs in this view. Open the assistant from a website tab and try again.');
  }

  try {
    const response = await browser.runtime.sendMessage(request);
    if (!response?.success) throw new Error(response?.error || 'The browser could not access the active tab.');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The browser could not access the active tab.';
    if (/context invalidated|receiving end does not exist|message port closed/i.test(message)) {
      throw new Error('JD Scan was updated or its worker is unavailable. Reload the extension, refresh this website, and reopen the assistant.');
    }
    throw new Error(message);
  }
}

export async function getActiveBrowserTab(): Promise<ActiveTab> {
  const response = await sendToBackground({ type: 'JD_SCAN_GET_ACTIVE_TAB' });
  const tab = response.tab as ActiveTab | undefined;
  if (!tab || !Number.isInteger(tab.id) || tab.id < 0 || !/^https?:\/\//i.test(tab.url || '')) {
    throw new Error('Open the job or application website in the active tab, then try again.');
  }
  return tab;
}

export async function openBrowserJobLink(url: string) {
  return sendToBackground({ type: 'JD_SCAN_OPEN_JOB_LINK', url });
}

export async function runBrowserApplication(input: Record<string, unknown>) {
  return sendToBackground({ type: 'JD_SCAN_RUN_APPLICATION', input });
}

export async function sendBrowserTabMessage(tabId: number, message: { type: string; [key: string]: unknown }) {
  if (!Number.isInteger(tabId) || tabId < 0 || !PAGE_MESSAGE_TYPES.has(message.type)) throw new Error('Unsupported page action.');
  const response = await sendToBackground({ type: 'JD_SCAN_SEND_TAB_MESSAGE', tabId, message });
  return response.response;
}
