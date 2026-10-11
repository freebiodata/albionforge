// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://albionforge.top',
  integrations: [
    sitemap({
      lastmod: new Date(),
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
