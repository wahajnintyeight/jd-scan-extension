import vm from 'node:vm';
import { build } from 'esbuild';

export async function load(entry, api, globals = {}) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node',
    define: { 'import.meta.env': '{"VITE_API_BASE_URL":"https://api.example.com/v2/api"}' },
    plugins: [{ name: 'extension-api', setup(builder) {
      if (globals.complete) {
        builder.onResolve({ filter: /utils\/api$/ }, ({ path }) => ({ path, namespace: 'completion' }));
        builder.onLoad({ filter: /.*/, namespace: 'completion' }, () => ({ contents: 'export const createLLMChatCompletion = (...args) => globalThis.complete(...args);' }));
      }
      builder.onResolve({ filter: /^wxt\// }, ({ path }) => ({ path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
        path === 'wxt/browser' ? 'export const browser = globalThis.chrome;' : 'export const defineBackground = options => options;'
      }));
    } }],
  });
  const context = vm.createContext({ chrome: api, module: { exports: {} }, console, URL, Headers, AbortController, AbortSignal, setTimeout, clearTimeout, setInterval, clearInterval, ...globals });
  vm.runInContext(result.outputFiles[0].text, context);
  return context.module.exports;
}
