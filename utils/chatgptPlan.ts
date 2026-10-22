export const CHATGPT_PLAN_CONFIG_ID = 'local-chatgpt-plan';
export const CHATGPT_NATIVE_HOST = 'com.jdscan.chatgpt';
export const DEFAULT_CHATGPT_MODEL = 'gpt-6.1-sol';

export interface ChatGPTPlanStatus {
  connected: boolean;
  email?: string;
  registered?: boolean;
}

export interface ChatGPTPlanModel {
  id: string;
  name: string;
}

export interface ChatGPTPlanPreferences {
  name: string;
  model: string;
  isActive: boolean;
}

interface NativeResponse<T> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

const PREFERENCES_KEY = 'chatGPTPlanPreferences';
const DEFAULT_PREFERENCES: ChatGPTPlanPreferences = {
  name: 'ChatGPT Plan',
  model: DEFAULT_CHATGPT_MODEL,
  isActive: true,
};

async function requestNative<T>(action: string, payload: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.connectNative) {
    throw new Error('The JD Scan ChatGPT helper is available only in the browser extension.');
  }

  return new Promise<T>((resolve, reject) => {
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connectNative(CHATGPT_NATIVE_HOST);
    } catch (error) {
      reject(new Error(error instanceof Error ? error.message : 'Could not start the local ChatGPT helper.'));
      return;
    }

    const id = crypto.randomUUID();
    let settled = false;
    const timer = setTimeout(() => finish(new Error('The local ChatGPT helper timed out.')), timeoutMs);
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
      try { port.disconnect(); } catch { /* The host may already have closed the port. */ }
      if (error) reject(error);
      else resolve(value as T);
    };
    const onMessage = (message: NativeResponse<T>) => {
      if (!message || message.id !== id) return;
      if (!message.success) finish(new Error(message.error || 'The local ChatGPT request failed.'));
      else finish(undefined, message.data as T);
    };
    const onDisconnect = () => finish(new Error(chrome.runtime.lastError?.message || 'Could not reach the local ChatGPT helper.'));

    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    try {
      port.postMessage({ id, action, ...payload });
    } catch (error) {
      finish(new Error(error instanceof Error ? error.message : 'Could not send a request to the local ChatGPT helper.'));
    }
  });
}

export function getChatGPTPlanStatus(): Promise<ChatGPTPlanStatus> {
  return requestNative<ChatGPTPlanStatus>('status');
}

export function connectChatGPTPlan(): Promise<ChatGPTPlanStatus> {
  return requestNative<ChatGPTPlanStatus>('connect', {}, 7 * 60_000);
}

export function disconnectChatGPTPlan(): Promise<{ revoked: boolean; warning?: string }> {
	return requestNative('disconnect', {}, 30_000);
}

export function switchChatGPTPlanAccount(): Promise<{ revoked: boolean; warning?: string }> {
	return requestNative('switch-account', {}, 30_000);
}

export function fetchChatGPTPlanModels(): Promise<ChatGPTPlanModel[]> {
  return requestNative<ChatGPTPlanModel[]>('models', {}, 30_000);
}

export function completeWithChatGPTPlan(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<{ text: string }> {
  return requestNative<{ text: string }>('complete', { model, messages }, 150_000);
}

export async function getChatGPTPlanPreferences(): Promise<ChatGPTPlanPreferences> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return DEFAULT_PREFERENCES;
  const stored = await chrome.storage.local.get(PREFERENCES_KEY);
  return { ...DEFAULT_PREFERENCES, ...(stored[PREFERENCES_KEY] || {}) };
}

export async function saveChatGPTPlanPreferences(
  update: Partial<ChatGPTPlanPreferences>,
): Promise<ChatGPTPlanPreferences> {
  const preferences = { ...await getChatGPTPlanPreferences(), ...update };
  await chrome.storage.local.set({ [PREFERENCES_KEY]: preferences });
  return preferences;
}
