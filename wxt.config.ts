import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['sidePanel', 'storage', 'tabs', 'activeTab'],
    host_permissions: [
      '*://*.linkedin.com/*',
      '*://*.indeed.com/*',
      '*://*.glassdoor.com/*',
      '*://*.wellfound.com/*',
      '*://*.indeed.co.uk/*',
      '*://*.indeed.ca/*',
      '*://*.pracuj.pl/*',
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
  vite: () => ({
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        process.env.VITE_API_BASE_URL || 'http://localhost:8881/v2/api'
      ),
    },
  }),
});
