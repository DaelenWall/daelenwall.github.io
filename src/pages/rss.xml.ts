import rss from '@astrojs/rss';
import { writing, site, url } from '../lib/content';
export async function GET(context: any) {
  return rss({
    title: `${site.name} — Writing`, description: site.description || 'Writing', site: new URL(url(''), context.site),
    items: (await writing()).map(entry => ({ title: entry.data.title, description: entry.data.description || undefined, link: url(`writing/${entry.data.slug}/`), ...(entry.data.firstPublishedAt ? { pubDate: new Date(`${entry.data.firstPublishedAt}T12:00:00Z`) } : {}) }))
  });
}
