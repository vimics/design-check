import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { casePlugin } from './plugins/case';

/** Limits the page to its own files. Applied to builds only, because dev tools need more. */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return html.replace('<!--__CSP__-->', ctx.server ? '' : `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  // Unit tests check the case folder themselves, with a clearer report than a failed start.
  plugins: process.env.VITEST ? [] : [contentSecurityPolicy(), casePlugin(process.env.CASE_DIR ?? 'case')],
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  worker: { format: 'es' },
  test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 },
});
