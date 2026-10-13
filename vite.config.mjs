import { defineConfig } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';

// The course measures original file sizes and validates AMP/XSLT documents.
// Keep these static snapshots byte-for-byte during production builds.
const entry = '\0course-static-entry';
const extensions = new Set(['.html', '.css', '.js', '.json', '.xml', '.xsl', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf']);
const excluded = new Set(['package.json', 'package-lock.json', 'vite.config.mjs']);
function staticSnapshots() {
  let root;
  return {
    name: 'course-static-snapshots',
    apply: 'build',
    configResolved(config) { root = config.root; },
    resolveId(id) { if (id === 'virtual:course-static-entry') return entry; },
    load(id) { if (id === entry) return 'export {};'; },
    buildStart() {
      const visit = (directory, nested = false) => {
        for (const item of readdirSync(directory, { withFileTypes: true })) {
          if (item.name.startsWith('.') || item.isSymbolicLink()) continue;
          const path = resolve(directory, item.name);
          if (item.isDirectory()) {
            if (nested || /^(task-\d{2}|assets|data|original)$/.test(item.name)) visit(path, true);
          } else if (nested || (!excluded.has(item.name) && extensions.has(extname(item.name)))) {
            this.emitFile({ type: 'asset', fileName: relative(root, path).replaceAll('\\', '/'), source: readFileSync(path) });
          }
        }
      };
      visit(root);
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
    },
    generateBundle(_options, bundle) {
      for (const [name, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && output.facadeModuleId === entry) delete bundle[name];
      }
    },
  };
}
export default defineConfig({
  appType: 'mpa',
  publicDir: false,
  optimizeDeps: { entries: [], noDiscovery: true },
  base: './',
  plugins: [staticSnapshots()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: { outDir: 'dist', rolldownOptions: { input: 'virtual:course-static-entry' } },
});
