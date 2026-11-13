import { z } from 'zod';
import MarkdownIt from 'markdown-it';

const text = z.string().max(200000);
const small = z.string().max(2000);
const image = z.string().regex(/^(?:|\/(?:images|studio-media)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:webp|png|jpg|jpeg|avif))$/);
const day = z.string().refine(value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value), 'Use a real calendar date (YYYY-MM-DD).');
const httpUrl = z.string().refine(value => { if (!value) return true; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }, 'Use a complete https:// or http:// URL.');
const entry = z.object({
  title: small.default(''), slug: z.string().max(120).default(''), category: z.string().max(100).default(''),
  body: text.default(''), description: small.default(''), tags: z.array(z.string().max(100)).max(50).default([]),
  coverImage: image.default(''), coverAlt: small.default(''),
  displayDate: day.default(''), writtenAt: day.default(''), firstPublishedAt: day.default(''),
  externalUrl: httpUrl.default('')
});
export const schemas = {
  writing: entry, projects: entry,
  home: z.object({ mode: z.enum(['minimal', 'introduction', 'quote']), intro: text, quote: text, attribution: small, portrait: image, portraitAlt: small, portraitStyle: z.enum(['natural', 'monochrome']), featuredWriting: z.array(z.string()).max(100), featuredProjects: z.array(z.string()).max(100) }),
  about: z.object({ body: text }),
  contact: z.object({ email: z.string().refine(value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.'), links: z.array(z.object({ label: z.string().max(100), url: httpUrl })).max(30) }),
  site: z.object({ name: z.literal('Daelen Wall'), description: small, categories: z.array(z.string().trim().min(1).max(100)).min(1).max(30).refine(items => new Set(items.map(item => item.toLowerCase())).size === items.length, 'Categories must be unique.'), navigation: z.object({ Home: z.string().min(1).max(30), Writing: z.string().min(1).max(30), Projects: z.string().min(1).max(30), About: z.string().min(1).max(30), Contact: z.string().min(1).max(30) }), socialImage: image, socialImageAlt: small })
};
export const defaults = {
  writing: entry.parse({}), projects: entry.parse({}), about: { body: '' }
};
export function parseData(kind, data, publishing = false) {
  if (!schemas[kind]) throw new Error('Unknown content type.');
  const result = schemas[kind].safeParse(data);
  if (!result.success) throw new Error(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  const value = result.data;
  if (publishing) {
    if (['writing', 'projects'].includes(kind)) {
      if (!value.title.trim()) throw new Error('A title is required to publish.');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) throw new Error('Use a URL slug containing lowercase letters, numbers, and hyphens.');
      if (kind === 'writing' && (!value.category.trim() || !value.body.trim())) throw new Error('An article needs a category and body before publication.');
      if (value.coverImage && !value.coverAlt.trim()) throw new Error('Describe the cover image in the alt text field.');
    }
    if (kind === 'home' && value.portrait && !value.portraitAlt.trim()) throw new Error('Describe your portrait in the alt text field.');
    if (kind === 'site' && value.socialImage && !value.socialImageAlt.trim()) throw new Error('Describe the social sharing image.');
    if (kind === 'contact' && value.links.some(link => !link.label.trim() || !link.url.trim())) throw new Error('Each contact link needs a label and a URL before publication.');
    if (value.body) {
      const tokens = new MarkdownIt().parse(value.body, {});
      for (const token of tokens) for (const child of token.children || []) if (child.type === 'image' && !child.content.trim()) throw new Error('Add a short description between the brackets of each Markdown image.');
    }
  }
  return value;
}
