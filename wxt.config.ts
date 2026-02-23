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
    ],
  },
});
