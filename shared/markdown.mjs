import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { withBase } from './paths.mjs';

export const escapeHtml = (text = '') => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
export function renderMarkdown(text = '', base = '/') {
  return sanitizeHtml(md.render(text), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'title', 'loading', 'decoding'], a: ['href', 'title', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attrs) => ({ tagName, attribs: { ...attrs, href: withBase(attrs.href || '', base), rel: 'noopener noreferrer' } }),
      img: (tagName, attrs) => ({ tagName, attribs: { ...attrs, src: withBase(attrs.src || '', base), loading: 'lazy', decoding: 'async' } })
    }
  });
}
export function readingTime(text = '') {
  const words = md.render(text).replace(/<[^>]*>/g, ' ').match(/[\p{L}\p{N}]+/gu)?.length || 0;
  return Math.max(1, Math.ceil(words / 220));
}
export function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '';
}
export const orderByDate = (entries, oldest = false) => [...entries].sort((a, b) => {
  const x = a.data.displayDate || '', y = b.data.displayDate || '';
  if (!x || !y) return x ? -1 : y ? 1 : a.data.title.localeCompare(b.data.title);
  return (oldest ? 1 : -1) * x.localeCompare(y) || a.data.title.localeCompare(b.data.title);
});
