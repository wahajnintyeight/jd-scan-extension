import { defineConfig } from 'wxt';

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'https://api.theprojectphoenix.top/v2/api';
const apiHostPermission = `${new URL(apiBaseUrl).origin}/*`;

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'JD Scan',
    description: 'Resume matching and supervised job application assistance.',
    version: '1.2.3',
    permissions: ['sidePanel', 'storage', 'tabs', 'activeTab', 'nativeMessaging'],
    action: {
      default_title: 'JD Scan - Quick Actions',
      default_popup: 'popup.html',
    },
    host_permissions: [
      apiHostPermission,
      'http://*/*',
      'https://*/*',
      '*://*.linkedin.com/*',
      '*://*.indeed.com/*',
      '*://*.glassdoor.com/*',
      '*://*.wellfound.com/*',
      '*://*.workable.com/*',
      '*://jobs.workable.com/*',
      '*://*.jobs.workable.com/*',
      '*://*.workable.io/*',
      '*://workable.io/*',
      '*://workable.com/*',
      '*://*.indeed.co.uk/*',
      '*://*.indeed.ca/*',
      '*://*.pracuj.pl/*',
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [
      {
        resources: ['pdf.worker.min.mjs'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        apiBaseUrl
      ),
    },
  }),
});
