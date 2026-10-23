const configuredApiUrl = import.meta.env?.VITE_API_BASE_URL;
export const API_BASE_URL = configuredApiUrl || 'https://api.theprojectphoenix.top/v2/api';

interface ApiProxyResponse {
  success: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  body?: string;
  error?: string;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const isWebPage = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
  if (!isWebPage) return fetch(input, init);

  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    throw new Error('JD Scan extension runtime is unavailable.');
  }

  const requestHeaders = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, name) => requestHeaders.set(name, value));
  const response = await chrome.runtime.sendMessage({
    type: 'JD_SCAN_API_REQUEST',
    url: input instanceof Request ? input.url : String(input),
    method: (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase(),
    headers: Object.fromEntries(requestHeaders.entries()),
    body: typeof init.body === 'string' ? init.body : undefined,
  }) as ApiProxyResponse | undefined;

  if (!response?.success || typeof response.status !== 'number') {
    throw new Error(response?.error || 'JD Scan could not reach its API.');
  }

  const body = [204, 205, 304].includes(response.status) ? null : response.body || '';
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.contentType ? { 'Content-Type': response.contentType } : undefined,
  });
}
