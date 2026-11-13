import { escapeHtml as e } from './markdown.mjs';
import { withBase } from './paths.mjs';

export const diagram = `<div class="diagram" aria-hidden="true"><div class="diagram-grid"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="diagram-axis axis-x"></div><div class="diagram-axis axis-y"></div><div class="diagram-disc"></div><div class="diagram-cross">+</div><span class="diagram-mark mark-top">+</span><span class="diagram-mark mark-bottom">+</span><span class="diagram-initials">DW</span></div>`;
export function heroHtml(home, base = '/') {
  const text = home.mode === 'introduction' && home.intro ? `<p class="hero-intro">${e(home.intro)}</p>` : home.mode === 'quote' && home.quote ? `<figure class="hero-quote"><blockquote>${e(home.quote)}</blockquote>${home.attribution ? `<figcaption>${e(home.attribution)}</figcaption>` : ''}</figure>` : '';
  return `<section class="hero"><div class="hero-main"><div class="eyebrow"><span class="signal"></span>Daelen Wall</div><h1 class="hero-name">Daelen<span>Wall<span class="name-dot">.</span></span></h1>${text}</div><div class="hero-visual ${home.portrait ? 'has-portrait' : ''}">${diagram}${home.portrait ? `<img class="portrait ${home.portraitStyle === 'monochrome' ? 'monochrome' : ''}" src="${e(withBase(home.portrait, base))}" alt="${e(home.portraitAlt)}" width="720" height="900" fetchpriority="high">` : ''}</div></section>`;
}
