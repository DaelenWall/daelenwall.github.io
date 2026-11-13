import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { deploymentConfig } from './shared/paths.mjs';

export default defineConfig({
  ...deploymentConfig(),
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  server: { host: '127.0.0.1' },
  devToolbar: { enabled: false }
});
